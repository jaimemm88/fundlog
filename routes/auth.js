const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const SECRET  = process.env.JWT_SECRET || 'tradevista-jwt-secret-2026';
const EXPIRES = '30d';

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: EXPIRES });
}

// ── Registro ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

  const hash = await bcrypt.hash(password, 12);
  const trialEnd = new Date(Date.now() + 7*24*60*60*1000).toISOString();
  const { trader_profile } = req.body;
  const r    = db.prepare('INSERT INTO users (name, email, password, plan, trial_ends_at, trader_profile) VALUES (?, ?, ?, ?, ?, ?)').run(name, email.toLowerCase(), hash, 'trial', trialEnd, trader_profile || '');
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(r.lastInsertRowid);

  res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email } });

  // Email de bienvenida (async)
  try {
    const { sendWelcomeEmail } = require('../services/mailer');
    sendWelcomeEmail(user)
      .then(() => console.log(`📧 Bienvenida enviada a ${user.email}`))
      .catch(e  => console.error(`📧 ERROR email bienvenida: ${e.message}`));
  } catch(e) {
    console.error(`📧 ERROR require mailer: ${e.message}`);
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña obligatorios' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email } });
});

// ── Perfil actual ─────────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth'), (req, res) => {
  const user = db.prepare('SELECT id, name, email, nickname, plan, trial_ends_at, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const now          = new Date();
  const trialEnd     = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const trialExpired = user.plan === 'trial' && trialEnd && now > trialEnd;
  const daysLeft     = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : null;

  res.json({ ...user, trial_expired: trialExpired, days_left: daysLeft });
});

// ── Actualizar perfil ─────────────────────────────────────────────────────────
router.put('/profile', require('../middleware/auth'), (req, res) => {
  const { name, email, nickname } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nombre y email obligatorios' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), req.user.id);
  if (exists) return res.status(409).json({ error: 'Ese email ya está en uso' });

  // Añadir columna nickname si no existe
  try { db.exec('ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT ""'); } catch(e) {}

  try {
    db.prepare('UPDATE users SET name = ?, email = ?, nickname = ? WHERE id = ?').run(name, email.toLowerCase(), nickname || '', req.user.id);
  } catch(e) {
    // Fallback sin nickname si falla
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email.toLowerCase(), req.user.id);
  }

  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
  try {
    const u2 = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.user.id);
    if (u2) user.nickname = u2.nickname;
  } catch(e) { user.nickname = ''; }
  // Renovar token con nuevo nombre/email
  const token = makeToken(user);
  res.json({ ok: true, user, token });
});

// ── Cambiar contraseña ────────────────────────────────────────────────────────
router.put('/password', require('../middleware/auth'), async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Faltan campos' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const ok   = await bcrypt.compare(current_password, user.password);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(new_password, 12);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// ── Olvidé mi contraseña ─────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email obligatorio' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  // Siempre respondemos igual para no revelar si el email existe
  if (!user) return res.json({ ok: true });

  // Generar token único
  const crypto = require('crypto');
  const token  = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
    .run(token, expires, user.id);

  // Enviar email
  try {
    const appUrl = process.env.APP_URL || 'https://fundlog.es';
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#0F2040,#1A3A6A);border-radius:16px 16px 0 0;padding:28px 40px;text-align:center;">
    <div style="font-size:24px;font-weight:800;"><span style="color:#fff;">Fund</span><span style="color:#7DB8E8;">Log</span></div>
  </td></tr>
  <tr><td style="background:#fff;padding:36px 40px;">
    <h2 style="font-size:24px;font-weight:800;color:#0C1A2E;margin:0 0 12px;">Recuperar contraseña</h2>
    <p style="font-size:15px;color:#6B7A99;line-height:1.7;margin:0 0 28px;">
      Hemos recibido una solicitud para restablecer la contraseña de <strong>${user.email}</strong>.
      Haz clic en el botón para crear una nueva. El enlace expira en 1 hora.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${appUrl}/reset-password?token=${token}"
           style="display:inline-block;background:linear-gradient(135deg,#1A3A6A,#2B72C8);color:#fff;text-decoration:none;padding:15px 36px;border-radius:10px;font-size:15px;font-weight:700;">
          → Cambiar contraseña
        </a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#94A3B8;margin-top:24px;text-align:center;">
      Si no solicitaste esto, ignora este email. Tu contraseña no cambiará.
    </p>
  </td></tr>
  <tr><td style="background:#0F2040;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
    <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">© 2026 FundLog · fundlog.es</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;

    await resend.emails.send({
      from:    process.env.RESEND_FROM || 'noreply@fundlog.es',
      to:      user.email,
      subject: 'Recuperar contraseña — FundLog',
      html,
    });
    console.log(`📧 Reset password enviado a ${user.email}`);
  } catch(e) {
    console.error(`📧 Error reset email: ${e.message}`);
  }

  res.json({ ok: true });
});

// ── Resetear contraseña ───────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token y contraseña obligatorios' });
  if (password.length < 6)  return res.status(400).json({ error: 'Mínimo 6 caracteres' });

  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Token inválido o ya usado' });
  if (new Date() > new Date(user.reset_token_expires)) {
    return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
  }

  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password = ?, reset_token = "", reset_token_expires = "" WHERE id = ?')
    .run(hash, user.id);

  res.json({ ok: true });
});

// ── Test email (con log detallado) ────────────────────────────────────────────
router.post('/email-test', require('../middleware/auth'), async (req, res) => {
  try {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'FundLog <noreply@fundlog.es>';
    console.log(`📧 Test — KEY configurada: ${!!key} | FROM: ${from}`);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const { sendTradeReminder } = require('../services/mailer');
    await sendTradeReminder(user, 1);
    res.json({ ok: true, to: user.email, key_set: !!key });
  } catch(e) {
    console.error(`📧 ERROR test: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ── Configurar API de emails ──────────────────────────────────────────────────
router.post('/email-config', require('../middleware/auth'), (req, res) => {
  const { resend_api_key, resend_from, app_url } = req.body;
  const { setSetting } = require('../services/calendarSync');
  if (resend_api_key) setSetting('RESEND_API_KEY', resend_api_key.trim());
  if (resend_from)    setSetting('RESEND_FROM', resend_from.trim());
  if (app_url)        setSetting('APP_URL', app_url.trim());
  res.json({ ok: true });
});

router.get('/email-config', require('../middleware/auth'), (req, res) => {
  const { getSetting } = require('../services/calendarSync');
  const key = getSetting('RESEND_API_KEY');
  res.json({
    configured: !!key,
    masked: key ? key.substring(0, 8) + '••••••••' : '',
    from:   getSetting('RESEND_FROM') || '',
    app_url:getSetting('APP_URL') || '',
  });
});

// ── Cambiar contraseña ────────────────────────────────────────────────────────
router.put('/password', require('../middleware/auth'), async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Faltan campos' });
  if (new_password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const ok = await bcrypt.compare(current_password, user.password);
  if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });

  const hash = await bcrypt.hash(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
