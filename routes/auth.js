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
  const r    = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email.toLowerCase(), hash);
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(r.lastInsertRowid);

  res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email } });

  // Email de bienvenida (async)
  try {
    const { sendWelcomeEmail } = require('../services/mailer');
    sendWelcomeEmail(user).catch(() => {});
  } catch(e) {}
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
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

// ── Actualizar perfil ─────────────────────────────────────────────────────────
router.put('/profile', require('../middleware/auth'), (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nombre y email obligatorios' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), req.user.id);
  if (exists) return res.status(409).json({ error: 'Ese email ya está en uso' });
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email.toLowerCase(), req.user.id);
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
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

// ── Test email ────────────────────────────────────────────────────────────────
router.post('/email-test', require('../middleware/auth'), async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const { sendTradeReminder } = require('../services/mailer');
    await sendTradeReminder(user, 1);
    res.json({ ok: true });
  } catch(e) {
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

module.exports = router;
