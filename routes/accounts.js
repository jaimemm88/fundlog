const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, broker, platform, type, currency, initial_balance } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const balance = parseFloat(initial_balance) || 0;
  const r = db.prepare(`
    INSERT INTO accounts (name, broker, platform, type, currency, initial_balance, balance, profit_target, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, broker || '', platform || '', type || 'fase1', currency || 'USD', balance, balance, parseFloat(req.body.profit_target) || 0, req.user.id);
  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, broker, platform, type, currency, initial_balance, balance, profit_target } = req.body;
  db.prepare(`
    UPDATE accounts SET name=?, broker=?, platform=?, type=?, currency=?, initial_balance=?, balance=?, profit_target=?
    WHERE id=? AND user_id=?
  `).run(name, broker, platform, type, currency, initial_balance, balance, parseFloat(profit_target) || 0, req.params.id, req.user.id);
  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
