const router = require('express').Router();
const db = require('../db');

// Monte Carlo simulation using input parameters
function runSimulation({ win_rate, avg_win, avg_loss, total_trades, initial_capital, risk_per_trade, iterations = 500 }) {
  const wr = win_rate / 100;
  const results = [];

  for (let i = 0; i < iterations; i++) {
    let equity = initial_capital;
    let peak = equity;
    let maxDD = 0;
    const curve = [equity];

    for (let t = 0; t < total_trades; t++) {
      const riskAmount = equity * (risk_per_trade / 100);
      const isWin = Math.random() < wr;
      const pnl = isWin ? riskAmount * (avg_win / Math.abs(avg_loss || 1)) : -riskAmount;
      equity += pnl;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      curve.push(Math.round(equity * 100) / 100);
      if (equity <= 0) break;
    }

    results.push({ final_equity: equity, max_drawdown: maxDD, curve });
  }

  // Aggregate statistics
  const finals = results.map(r => r.final_equity).sort((a, b) => a - b);
  const dds = results.map(r => r.max_drawdown).sort((a, b) => a - b);
  const medianIdx = Math.floor(iterations / 2);
  const bestResult = results[results.map(r => r.final_equity).indexOf(finals[finals.length - 1])];
  const medianResult = results[results.map(r => r.final_equity).indexOf(finals[medianIdx])];
  const worstResult = results[results.map(r => r.final_equity).indexOf(finals[0])];

  const profitable = finals.filter(f => f > initial_capital).length;

  return {
    probability_of_profit: (profitable / iterations * 100).toFixed(1),
    median_final_equity:   finals[medianIdx].toFixed(2),
    best_final_equity:     finals[finals.length - 1].toFixed(2),
    worst_final_equity:    finals[0].toFixed(2),
    median_max_drawdown:   dds[medianIdx].toFixed(2),
    best_curve:            bestResult.curve,
    median_curve:          medianResult.curve,
    worst_curve:           worstResult.curve,
    p10: finals[Math.floor(iterations * 0.1)].toFixed(2),
    p90: finals[Math.floor(iterations * 0.9)].toFixed(2),
  };
}

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM backtests ORDER BY created_at DESC').all());
});

router.post('/run', (req, res) => {
  const {
    strategy_name, pair, timeframe, start_date, end_date,
    initial_capital = 10000, risk_per_trade = 1,
    win_rate, avg_win, avg_loss, total_trades = 200
  } = req.body;

  if (!win_rate || !avg_win || !avg_loss) {
    return res.status(400).json({ error: 'win_rate, avg_win, avg_loss required' });
  }

  const sim = runSimulation({
    win_rate: parseFloat(win_rate),
    avg_win: parseFloat(avg_win),
    avg_loss: parseFloat(avg_loss),
    total_trades: parseInt(total_trades),
    initial_capital: parseFloat(initial_capital),
    risk_per_trade: parseFloat(risk_per_trade),
  });

  const profit_factor = Math.abs(avg_loss) > 0
    ? (win_rate / 100 * avg_win) / ((1 - win_rate / 100) * Math.abs(avg_loss))
    : 0;

  const total_pnl = parseFloat(sim.median_final_equity) - parseFloat(initial_capital);

  const r = db.prepare(`
    INSERT INTO backtests (strategy_name, pair, timeframe, start_date, end_date, initial_capital,
      risk_per_trade, total_trades, win_rate, profit_factor, total_pnl, max_drawdown, equity_curve)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    strategy_name || '', pair || '', timeframe || '', start_date || '', end_date || '',
    initial_capital, risk_per_trade, total_trades, win_rate,
    profit_factor.toFixed(2), total_pnl.toFixed(2), sim.median_max_drawdown,
    JSON.stringify(sim.median_curve)
  );

  res.json({
    id: r.lastInsertRowid,
    simulation: sim,
    profit_factor: profit_factor.toFixed(2),
    total_pnl: total_pnl.toFixed(2),
    params: { strategy_name, pair, timeframe, win_rate, avg_win, avg_loss, total_trades, initial_capital, risk_per_trade }
  });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM backtests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
