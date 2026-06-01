const router = require('express').Router();
const db = require('../db');

const FULL = `
  SELECT t.*, a.name as account_name, a.currency, s.name as strategy_name
  FROM trades t
  LEFT JOIN accounts a ON t.account_id = a.id
  LEFT JOIN strategies s ON t.strategy_id = s.id
`;

// ── Importación masiva desde CSV ──────────────────────────────────────────────
router.post('/import', (req, res) => {
  const { trades, account_id } = req.body;
  if (!Array.isArray(trades) || !trades.length) {
    return res.status(400).json({ error: 'No hay operaciones para importar' });
  }

  const insert = db.prepare(`
    INSERT INTO trades (account_id, pair, type, entry_price, exit_price, size, pnl, date, session, result, notes, external_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0, skipped = 0;

  const importAll = db.transaction(() => {
    for (const t of trades) {
      if (!t.pair || !t.date) { skipped++; continue; }

      // Evitar duplicados por external_id
      if (t.external_id) {
        const exists = db.prepare(
          'SELECT id FROM trades WHERE external_id = ? AND external_id != "" AND user_id = ?'
        ).get(t.external_id, req.user.id);
        if (exists) { skipped++; continue; }
      }

      const numPnl = parseFloat(t.pnl) || 0;
      insert.run(
        account_id || null,
        t.pair, t.type || 'long',
        parseFloat(t.entry_price) || 0,
        parseFloat(t.exit_price)  || 0,
        parseFloat(t.size)        || 0,
        numPnl,
        t.date,
        t.session || '',
        numPnl >= 0 ? 'win' : 'loss',
        t.notes || 'Importado CSV',
        t.external_id || '',
        req.user.id
      );
      // Actualizar balance de la cuenta
      if (account_id) {
        db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?')
          .run(numPnl, account_id, req.user.id);
      }
      inserted++;
    }
  });

  importAll();
  res.json({ ok: true, inserted, skipped });
});

router.get('/', (req, res) => {
  const { account_id, strategy_id, result, pair, from, to, limit } = req.query;
  let sql = FULL + ' WHERE t.user_id = ?';
  const params = [req.user.id];

  if (account_id)  { sql += ' AND t.account_id = ?';  params.push(account_id); }
  if (strategy_id) { sql += ' AND t.strategy_id = ?'; params.push(strategy_id); }
  if (result)      { sql += ' AND t.result = ?';       params.push(result); }
  if (pair)        { sql += ' AND t.pair LIKE ?';      params.push(`%${pair}%`); }
  if (from)        { sql += ' AND t.date >= ?';        params.push(from); }
  if (to)          { sql += ' AND t.date <= ?';        params.push(to); }

  sql += ' ORDER BY t.date DESC, t.id DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }

  res.json(db.prepare(sql).all(...params));
});

router.get('/summary', (req, res) => {
  const { account_id, from, to } = req.query;
  let where = 'WHERE user_id = ?'; const p = [req.user.id];
  if (account_id) { where += ' AND account_id = ?'; p.push(account_id); }
  if (from)       { where += ' AND date >= ?'; p.push(from); }
  if (to)         { where += ' AND date <= ?'; p.push(to); }

  const stats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as losses,
      SUM(pnl) as total_pnl,
      AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
      AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss,
      MAX(pnl) as best_trade, MIN(pnl) as worst_trade
    FROM trades ${where}
  `).get(...p);
  res.json(stats);
});

router.get('/daily-pnl', (req, res) => {
  const { account_id, from, to } = req.query;
  let where = 'WHERE user_id = ?'; const p = [req.user.id];
  if (account_id) { where += ' AND account_id = ?'; p.push(account_id); }
  if (from)       { where += ' AND date >= ?'; p.push(from); }
  if (to)         { where += ' AND date <= ?'; p.push(to); }
  res.json(db.prepare(`SELECT date, SUM(pnl) as pnl, COUNT(*) as trades FROM trades ${where} GROUP BY date ORDER BY date ASC`).all(...p));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(FULL + ' WHERE t.id = ? AND t.user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { account_id, strategy_id, pair, type, entry_price, exit_price, size, pnl, date, session, notes, screenshot_url } = req.body;
  if (!pair || !type || !date) return res.status(400).json({ error: 'pair, type, date required' });
  const numPnl = parseFloat(pnl) || 0;
  const result = numPnl >= 0 ? 'win' : 'loss';
  const r = db.prepare(`
    INSERT INTO trades (account_id, strategy_id, pair, type, entry_price, exit_price, size, pnl, date, session, notes, result, screenshot_url, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(account_id || null, strategy_id || null, pair, type, entry_price || 0, exit_price || 0, size || 0, numPnl, date, session || '', notes || '', result, screenshot_url || '', req.user.id);

  if (account_id) db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?').run(numPnl, account_id, req.user.id);
  res.json(db.prepare(FULL + ' WHERE t.id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trades WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { account_id, strategy_id, pair, type, entry_price, exit_price, size, pnl, date, session, notes, screenshot_url } = req.body;
  const numPnl = parseFloat(pnl) || 0;
  const result = numPnl >= 0 ? 'win' : 'loss';

  if (existing.account_id) db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?').run(existing.pnl, existing.account_id, req.user.id);
  if (account_id)          db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ? AND user_id = ?').run(numPnl, account_id, req.user.id);

  db.prepare(`
    UPDATE trades SET account_id=?, strategy_id=?, pair=?, type=?, entry_price=?, exit_price=?,
    size=?, pnl=?, date=?, session=?, notes=?, result=?, screenshot_url=? WHERE id=? AND user_id=?
  `).run(account_id || null, strategy_id || null, pair, type, entry_price || 0, exit_price || 0, size || 0, numPnl, date, session || '', notes || '', result, screenshot_url || existing.screenshot_url || '', req.params.id, req.user.id);

  res.json(db.prepare(FULL + ' WHERE t.id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trades WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.account_id) db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ? AND user_id = ?').run(existing.pnl, existing.account_id, req.user.id);
  db.prepare('DELETE FROM trades WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
