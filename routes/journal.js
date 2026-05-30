const router = require('express').Router();
const db = require('../db');

// Asegurar que la tabla existe
db.exec(`CREATE TABLE IF NOT EXISTS journal (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  date              TEXT NOT NULL,
  mood              TEXT DEFAULT '',
  market_conditions TEXT DEFAULT '',
  went_well         TEXT DEFAULT '',
  went_wrong        TEXT DEFAULT '',
  lessons           TEXT DEFAULT '',
  rules_followed    INTEGER DEFAULT 1,
  notes             TEXT DEFAULT '',
  created_at        TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
)`);

router.get('/', (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM journal WHERE user_id = ?';
  const p = [req.user.id];
  if (from) { sql += ' AND date >= ?'; p.push(from); }
  if (to)   { sql += ' AND date <= ?'; p.push(to); }
  sql += ' ORDER BY date DESC';
  res.json(db.prepare(sql).all(...p));
});

router.get('/:date', (req, res) => {
  const row = db.prepare('SELECT * FROM journal WHERE user_id = ? AND date = ?').get(req.user.id, req.params.date);
  res.json(row || null);
});

router.post('/', (req, res) => {
  const { date, mood, market_conditions, went_well, went_wrong, lessons, rules_followed, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  db.prepare(`
    INSERT INTO journal (user_id, date, mood, market_conditions, went_well, went_wrong, lessons, rules_followed, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      mood=excluded.mood, market_conditions=excluded.market_conditions,
      went_well=excluded.went_well, went_wrong=excluded.went_wrong,
      lessons=excluded.lessons, rules_followed=excluded.rules_followed, notes=excluded.notes
  `).run(req.user.id, date, mood||'', market_conditions||'', went_well||'', went_wrong||'', lessons||'', rules_followed?1:0, notes||'');
  res.json(db.prepare('SELECT * FROM journal WHERE user_id = ? AND date = ?').get(req.user.id, date));
});

router.delete('/:date', (req, res) => {
  db.prepare('DELETE FROM journal WHERE user_id = ? AND date = ?').run(req.user.id, req.params.date);
  res.json({ ok: true });
});

module.exports = router;
