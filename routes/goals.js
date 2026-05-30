const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id));
});

router.post('/', (req, res) => {
  const { name, metric, target_value, current_value, deadline } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare(`
    INSERT INTO goals (name, metric, target_value, current_value, deadline, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, metric || '', parseFloat(target_value) || 0, parseFloat(current_value) || 0, deadline || '', req.user.id);
  res.json(db.prepare('SELECT * FROM goals WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, metric, target_value, current_value, deadline, status } = req.body;
  db.prepare(`
    UPDATE goals SET name=?, metric=?, target_value=?, current_value=?, deadline=?, status=?
    WHERE id=? AND user_id=?
  `).run(name, metric, parseFloat(target_value) || 0, parseFloat(current_value) || 0, deadline || '', status || 'active', req.params.id, req.user.id);
  res.json(db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
