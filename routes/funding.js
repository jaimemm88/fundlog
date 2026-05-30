const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { account_id } = req.query;
  let sql = `SELECT f.*, a.name as account_name FROM funding f LEFT JOIN accounts a ON f.account_id = a.id WHERE f.user_id = ?`;
  const p = [req.user.id];
  if (account_id) { sql += ' AND f.account_id = ?'; p.push(account_id); }
  sql += ' ORDER BY f.date DESC, f.id DESC';
  res.json(db.prepare(sql).all(...p));
});

router.get('/summary', (req, res) => {
  const s = db.prepare(`
    SELECT
      SUM(CASE WHEN type='deposit'    THEN amount ELSE 0 END) as total_deposited,
      SUM(CASE WHEN type='withdrawal' THEN ABS(amount) ELSE 0 END) as total_withdrawn,
      SUM(CASE WHEN type='commission' THEN ABS(amount) ELSE 0 END) as total_commissions,
      COUNT(*) as total_movements
    FROM funding WHERE user_id = ?
  `).get(req.user.id);
  res.json(s);
});

router.post('/', (req, res) => {
  const { account_id, type, amount, date, notes } = req.body;
  if (!type || !amount || !date) return res.status(400).json({ error: 'type, amount, date required' });
  const numAmt = parseFloat(amount);
  const r = db.prepare(`
    INSERT INTO funding (account_id, type, amount, date, notes, user_id) VALUES (?, ?, ?, ?, ?, ?)
  `).run(account_id || null, type, numAmt, date, notes || '', req.user.id);
  if (account_id && (type === 'deposit' || type === 'withdrawal')) {
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?').run(numAmt, account_id, req.user.id);
  }
  res.json(db.prepare('SELECT * FROM funding WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM funding WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.account_id && (row.type === 'deposit' || row.type === 'withdrawal')) {
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?').run(row.amount, row.account_id, req.user.id);
  }
  db.prepare('DELETE FROM funding WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
