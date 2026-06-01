const router    = require('express').Router();
const db        = require('../db');
const auth      = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

// Todos los endpoints requieren auth + admin
router.use(auth, adminOnly);

// ── Stats generales ───────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const total    = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const trial    = db.prepare("SELECT COUNT(*) as n FROM users WHERE plan = 'trial'").get().n;
  const pro      = db.prepare("SELECT COUNT(*) as n FROM users WHERE plan = 'pro'").get().n;
  const today    = new Date().toISOString().split('T')[0];
  const newToday = db.prepare("SELECT COUNT(*) as n FROM users WHERE date(created_at) = ?").get(today).n;
  const expiring = db.prepare(`
    SELECT COUNT(*) as n FROM users
    WHERE plan = 'trial' AND trial_ends_at != '' AND date(trial_ends_at) <= date('now', '+3 days') AND date(trial_ends_at) >= date('now')
  `).get().n;

  // Perfiles
  const profiles = db.prepare(`
    SELECT trader_profile, COUNT(*) as n FROM users WHERE trader_profile != '' GROUP BY trader_profile ORDER BY n DESC
  `).all();

  res.json({ total, trial, pro, newToday, expiring, profiles });
});

// ── Lista de usuarios ─────────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  const { search, plan } = req.query;
  let sql = `SELECT id, name, email, plan, trial_ends_at, trader_profile, created_at, stripe_customer_id FROM users WHERE 1=1`;
  const p = [];
  if (search) { sql += ' AND (name LIKE ? OR email LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
  if (plan)   { sql += ' AND plan = ?'; p.push(plan); }
  sql += ' ORDER BY created_at DESC';
  const users = db.prepare(sql).all(...p);

  // Añadir info extra
  const now = new Date();
  res.json(users.map(u => {
    const trialEnd     = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
    const trialExpired = u.plan === 'trial' && trialEnd && now > trialEnd;
    const daysLeft     = trialEnd ? Math.ceil((trialEnd - now) / 86400000) : null;
    return { ...u, trial_expired: trialExpired, days_left: daysLeft };
  }));
});

// ── Cambiar plan de un usuario ────────────────────────────────────────────────
router.put('/users/:id/plan', (req, res) => {
  const { plan } = req.body;
  if (!['trial','pro','cancelled'].includes(plan)) return res.status(400).json({ error: 'Plan inválido' });
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.params.id);
  res.json({ ok: true });
});

// ── Eliminar usuario ──────────────────────────────────────────────────────────
router.delete('/users/:id', (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM trades WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM accounts WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM strategies WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM goals WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM funding WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ── Crear usuario demo ────────────────────────────────────────────────────────
router.post('/seed-demo', async (req, res) => {
  try {
    const { seedDemo } = require('../scripts/seed-demo');
    const uid = await seedDemo();
    res.json({ ok: true, message: 'Usuario demo creado', uid, email: 'demo@fundlog.es', password: 'usuario' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
