const router = require('express').Router();
const db = require('../db');
const { syncFromFinnhub, getSetting, setSetting } = require('../services/calendarSync');

router.get('/', (req, res) => {
  const { from, to, impact, currency } = req.query;
  // El calendario económico es compartido + eventos propios del usuario
  let sql = 'SELECT * FROM economic_calendar WHERE (user_id = ? OR user_id IS NULL OR user_id = 0 OR user_id = 1)';
  const p = [req.user.id];
  if (from)     { sql += ' AND date >= ?';    p.push(from); }
  if (to)       { sql += ' AND date <= ?';    p.push(to); }
  if (impact)   { sql += ' AND impact = ?';   p.push(impact); }
  if (currency) { sql += ' AND currency = ?'; p.push(currency); }
  sql += ' ORDER BY date ASC, time ASC';
  res.json(db.prepare(sql).all(...p));
});

router.get('/settings', (req, res) => {
  const key     = getSetting('FINNHUB_API_KEY');
  const masked  = key ? key.substring(0, 6) + '••••••••••••' : '';
  const lastSync = getSetting('LAST_ECO_SYNC');
  res.json({ configured: !!key, masked, lastSync });
});

router.post('/settings', (req, res) => {
  const { api_key } = req.body;
  if (!api_key || api_key.length < 10) return res.status(400).json({ error: 'API key inválida' });
  setSetting('FINNHUB_API_KEY', api_key.trim());
  res.json({ ok: true });
});

router.post('/sync', async (req, res) => {
  try {
    const { syncForexFactory } = require('../services/ffCalendar');
    const result = await syncForexFactory();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', (req, res) => {
  const { date, time, country, currency, event, impact, previous, forecast } = req.body;
  if (!date || !event) return res.status(400).json({ error: 'date and event required' });
  const r = db.prepare(`
    INSERT INTO economic_calendar (date, time, country, currency, event, impact, previous, forecast, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, time || '', country || '', currency || '', event, impact || 'medium', previous || '', forecast || '', req.user.id);
  res.json(db.prepare('SELECT * FROM economic_calendar WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { date, time, country, currency, event, impact, previous, forecast, actual } = req.body;
  db.prepare(`UPDATE economic_calendar SET date=?, time=?, country=?, currency=?, event=?, impact=?, previous=?, forecast=?, actual=? WHERE id=?`)
    .run(date, time, country, currency, event, impact, previous, forecast, actual || '', req.params.id);
  res.json(db.prepare('SELECT * FROM economic_calendar WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM economic_calendar WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
