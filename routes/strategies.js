const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM strategies WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const stats = db.prepare(`
    SELECT strategy_id,
      COUNT(*) as total,
      SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
      SUM(pnl) as total_pnl,
      AVG(CASE WHEN pnl>0 THEN pnl END) as avg_win,
      AVG(CASE WHEN pnl<0 THEN pnl END) as avg_loss
    FROM trades WHERE user_id = ? AND strategy_id IS NOT NULL GROUP BY strategy_id
  `).all(req.user.id);
  const statsMap = Object.fromEntries(stats.map(s => [s.strategy_id, s]));
  res.json(rows.map(r => ({ ...r, stats: statsMap[r.id] || null })));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM strategies WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, market, timeframe, target_rr, description, status } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare(`
    INSERT INTO strategies (name, market, timeframe, target_rr, description, status, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, market || '', timeframe || '', target_rr || '', description || '', status || 'active', req.user.id);
  res.json(db.prepare('SELECT * FROM strategies WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, market, timeframe, target_rr, description, status } = req.body;
  db.prepare(`
    UPDATE strategies SET name=?, market=?, timeframe=?, target_rr=?, description=?, status=?
    WHERE id=? AND user_id=?
  `).run(name, market, timeframe, target_rr, description, status, req.params.id, req.user.id);
  res.json(db.prepare('SELECT * FROM strategies WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE trades SET strategy_id = NULL WHERE strategy_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  db.prepare('DELETE FROM strategies WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
