const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { account_id } = req.query;
  let row = account_id
    ? db.prepare('SELECT * FROM risk_settings WHERE account_id = ? AND user_id = ?').get(account_id, req.user.id)
    : db.prepare('SELECT * FROM risk_settings WHERE user_id = ? LIMIT 1').get(req.user.id);
  if (!row) row = { max_risk_per_trade: 1, max_daily_drawdown: 3, max_total_drawdown: 5, max_open_trades: 5, max_daily_loss: 0 };
  res.json(row);
});

router.put('/', (req, res) => {
  const { account_id, max_risk_per_trade, max_daily_drawdown, max_total_drawdown, max_open_trades, max_daily_loss } = req.body;
  const existing = account_id
    ? db.prepare('SELECT id FROM risk_settings WHERE account_id = ? AND user_id = ?').get(account_id, req.user.id)
    : db.prepare('SELECT id FROM risk_settings WHERE user_id = ? LIMIT 1').get(req.user.id);

  if (existing) {
    db.prepare(`UPDATE risk_settings SET max_risk_per_trade=?, max_daily_drawdown=?, max_total_drawdown=?, max_open_trades=?, max_daily_loss=? WHERE id=?`)
      .run(max_risk_per_trade, max_daily_drawdown, max_total_drawdown, max_open_trades, max_daily_loss, existing.id);
    res.json(db.prepare('SELECT * FROM risk_settings WHERE id = ?').get(existing.id));
  } else {
    const r = db.prepare(`INSERT INTO risk_settings (account_id, max_risk_per_trade, max_daily_drawdown, max_total_drawdown, max_open_trades, max_daily_loss, user_id) VALUES (?,?,?,?,?,?,?)`)
      .run(account_id || null, max_risk_per_trade, max_daily_drawdown, max_total_drawdown, max_open_trades, max_daily_loss, req.user.id);
    res.json(db.prepare('SELECT * FROM risk_settings WHERE id = ?').get(r.lastInsertRowid));
  }
});

module.exports = router;
