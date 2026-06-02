const router = require('express').Router();
const db = require('../db');

function baseWhere(q, userId) {
  let where = 'WHERE t.user_id = ?'; const p = [userId];
  if (q.account_id) { where += ' AND t.account_id = ?'; p.push(q.account_id); }
  if (q.from)       { where += ' AND t.date >= ?';      p.push(q.from); }
  if (q.to)         { where += ' AND t.date <= ?';      p.push(q.to); }
  return { where, p };
}

router.get('/stats', (req, res) => {
  const { where, p } = baseWhere(req.query, req.user.id);
  const base = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) as losses,
      SUM(pnl) as total_pnl,
      AVG(CASE WHEN pnl>0 THEN pnl END) as avg_win,
      AVG(CASE WHEN pnl<0 THEN pnl END) as avg_loss,
      MAX(pnl) as best_trade, MIN(pnl) as worst_trade,
      SUM(CASE WHEN pnl>0 THEN pnl ELSE 0 END) as gross_profit,
      ABS(SUM(CASE WHEN pnl<0 THEN pnl ELSE 0 END)) as gross_loss
    FROM trades t ${where}
  `).get(...p);

  const profit_factor = base.gross_loss > 0 ? base.gross_profit / base.gross_loss : base.gross_profit > 0 ? 999 : 0;
  const win_rate      = base.total > 0 ? base.wins / base.total * 100 : 0;
  const expectancy    = base.total > 0 ? base.total_pnl / base.total : 0;

  const daily = db.prepare(`SELECT SUM(pnl) as d FROM trades t ${where} GROUP BY date ORDER BY date`).all(...p);
  let sharpe  = 0;
  if (daily.length > 1) {
    const returns = daily.map(d => d.d);
    const mean    = returns.reduce((a,b) => a+b, 0) / returns.length;
    const std     = Math.sqrt(returns.reduce((a,b) => a+(b-mean)**2, 0) / returns.length);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
  }

  const allDays = db.prepare(`SELECT date, SUM(pnl) as d FROM trades t ${where} GROUP BY date ORDER BY date`).all(...p);

  // Obtener balance total de las cuentas para calcular DD sobre balance real
  const accountBalance = (() => {
    try {
      const uid = req.user?.id;
      if (!uid) return 0;
      const aid = req.query.account_id;
      if (aid) {
        const acc = db.prepare('SELECT balance, initial_balance FROM accounts WHERE id = ? AND user_id = ?').get(aid, uid);
        return acc ? (acc.initial_balance || acc.balance || 0) : 0;
      }
      const accs = db.prepare('SELECT initial_balance, balance FROM accounts WHERE user_id = ?').all(uid);
      return accs.reduce((s, a) => s + (a.initial_balance || a.balance || 0), 0);
    } catch(e) { return 0; }
  })();

  let maxDD = 0, cumPnl = 0, maxLoss = 0;
  for (const day of allDays) {
    cumPnl += day.d;
    if (day.d < maxLoss) maxLoss = day.d; // peor día
  }
  // DD = mayor pérdida acumulada desde un pico, relativa al balance de cuenta
  let peak = 0, equity = 0;
  for (const day of allDays) {
    equity += day.d;
    if (equity > peak) peak = equity;
    const loss = peak - equity; // pérdida en $ desde el pico
    const base = accountBalance > 0 ? accountBalance : Math.max(Math.abs(peak), 1);
    const dd = (loss / base) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  const results = db.prepare(`SELECT result FROM trades t ${where} ORDER BY date ASC, id ASC`).all(...p).map(r => r.result);
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
  for (const r of results) {
    if (r === 'win') { curW++; curL = 0; if (curW > maxWinStreak)  maxWinStreak  = curW; }
    else             { curL++; curW = 0; if (curL > maxLossStreak) maxLossStreak = curL; }
  }

  res.json({ ...base, profit_factor, win_rate, expectancy, sharpe, max_drawdown: maxDD, max_win_streak: maxWinStreak, max_loss_streak: maxLossStreak });
});

router.get('/by-pair', (req, res) => {
  const { where, p } = baseWhere(req.query, req.user.id);
  res.json(db.prepare(`SELECT pair, SUM(pnl) as pnl, COUNT(*) as trades, SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins FROM trades t ${where} GROUP BY pair ORDER BY pnl DESC`).all(...p));
});

router.get('/by-session', (req, res) => {
  const { where, p } = baseWhere(req.query, req.user.id);
  res.json(db.prepare(`SELECT session, SUM(pnl) as pnl, COUNT(*) as trades, SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins FROM trades t ${where} GROUP BY session ORDER BY pnl DESC`).all(...p));
});

router.get('/by-weekday', (req, res) => {
  const { where, p } = baseWhere(req.query, req.user.id);
  res.json(db.prepare(`SELECT strftime('%w', date) as dow, SUM(pnl) as pnl, COUNT(*) as trades FROM trades t ${where} GROUP BY dow ORDER BY dow`).all(...p));
});

router.get('/by-strategy', (req, res) => {
  const { where, p } = baseWhere(req.query, req.user.id);
  res.json(db.prepare(`SELECT s.name as strategy, SUM(t.pnl) as pnl, COUNT(*) as trades, SUM(CASE WHEN t.result='win' THEN 1 ELSE 0 END) as wins FROM trades t LEFT JOIN strategies s ON t.strategy_id = s.id ${where} GROUP BY t.strategy_id ORDER BY pnl DESC`).all(...p));
});

router.get('/equity', (req, res) => {
  const { where, p } = baseWhere(req.query, req.user.id);
  const rows = db.prepare(`SELECT date, SUM(pnl) as daily_pnl FROM trades t ${where} GROUP BY date ORDER BY date ASC`).all(...p);
  let cumulative = 0;
  res.json(rows.map(r => { cumulative += r.daily_pnl; return { date: r.date, pnl: r.daily_pnl, equity: cumulative }; }));
});

router.get('/monthly', (req, res) => {
  const { where, p } = baseWhere(req.query, req.user.id);
  res.json(db.prepare(`SELECT strftime('%Y-%m', date) as month, SUM(pnl) as pnl, COUNT(*) as trades FROM trades t ${where} GROUP BY month ORDER BY month ASC`).all(...p));
});

module.exports = router;
