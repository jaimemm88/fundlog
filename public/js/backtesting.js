// ─── Backtesting ──────────────────────────────────────────────────────────────
const Backtesting = {
  async load() {
    Backtesting._renderHistory();
  },

  async run() {
    const btn = document.getElementById('btnRunBacktest');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Simulando…';

    const data = {
      strategy_name:   document.getElementById('bt-name').value.trim(),
      pair:            document.getElementById('bt-pair').value.trim(),
      timeframe:       document.getElementById('bt-tf').value.trim(),
      initial_capital: parseFloat(document.getElementById('bt-capital').value) || 10000,
      risk_per_trade:  parseFloat(document.getElementById('bt-risk').value) || 1,
      win_rate:        parseFloat(document.getElementById('bt-wr').value) || 60,
      avg_win:         parseFloat(document.getElementById('bt-avgwin').value) || 150,
      avg_loss:        parseFloat(document.getElementById('bt-avgloss').value) || 70,
      total_trades:    parseInt(document.getElementById('bt-trades').value) || 200,
    };

    try {
      const result = await API.backtesting.run(data);
      Backtesting._renderResults(result, data);
      Backtesting._renderHistory();
      UI.toast('Simulación completada', 'success');
    } catch (e) {
      UI.toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-player-play"></i> Ejecutar simulación';
    }
  },

  _renderResults(result, params) {
    const card = document.getElementById('bt-results');
    card.style.display = 'block';
    const sim = result.simulation;
    const capital = params.initial_capital;

    document.getElementById('bt-stats').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div class="metric">
          <div class="metric-label">P&L mediano</div>
          <div class="metric-val ${parseFloat(result.total_pnl) >= 0 ? 'pos' : 'neg'} mono">${UI.pnlStr(result.total_pnl)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Profit Factor</div>
          <div class="metric-val mono">${result.profit_factor}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Prob. de beneficio</div>
          <div class="metric-val mono">${sim.probability_of_profit}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">DD máximo mediano</div>
          <div class="metric-val neg mono">−${sim.median_max_drawdown}%</div>
        </div>
      </div>
      ${UI.statRow('Capital inicial', UI.fmtCurrency(capital))}
      ${UI.statRow('Equity mediana final', UI.fmtCurrency(sim.median_final_equity), '', parseFloat(sim.median_final_equity) >= capital ? 'pos' : 'neg')}
      ${UI.statRow('Mejor escenario (P90)', UI.fmtCurrency(sim.p90), 'pos')}
      ${UI.statRow('Peor escenario (P10)', UI.fmtCurrency(sim.p10), 'neg')}
      ${UI.statRow('Win rate', params.win_rate + '%')}
      ${UI.statRow('Ratio R:R implícito', '1:' + (params.avg_win / params.avg_loss).toFixed(2))}
    `;

    // Chart
    const labels = sim.median_curve.map((_, i) => i);
    UI.chart('chartBacktest', {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Mejor',
            data: sim.best_curve,
            borderColor: 'rgba(29,158,117,0.8)',
            backgroundColor: 'rgba(29,158,117,0.04)',
            tension: 0.3, fill: false, pointRadius: 0, borderWidth: 1.5,
          },
          {
            label: 'Mediana',
            data: sim.median_curve,
            borderColor: '#378ADD',
            backgroundColor: 'rgba(55,138,221,0.08)',
            tension: 0.3, fill: true, pointRadius: 0, borderWidth: 2,
          },
          {
            label: 'Peor',
            data: sim.worst_curve,
            borderColor: 'rgba(216,90,48,0.8)',
            backgroundColor: 'rgba(216,90,48,0.04)',
            tension: 0.3, fill: false, pointRadius: 0, borderWidth: 1.5,
          },
        ]
      },
      options: {
        ...UI.chartDefaults,
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { family: 'Sora', size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${UI.fmtCurrency(ctx.raw)}` } }
        },
      }
    });
  },

  async _renderHistory() {
    const history = await API.backtesting.list();
    const body    = document.getElementById('btHistoryBody');
    const empty   = document.getElementById('btHistoryEmpty');

    if (!history.length) {
      body.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    body.innerHTML = history.map(b => `
      <tr>
        <td>${b.strategy_name || '—'}</td>
        <td class="mono">${b.pair || '—'}</td>
        <td class="mono">${b.win_rate}%</td>
        <td class="mono">${b.profit_factor}</td>
        <td class="${parseFloat(b.total_pnl) >= 0 ? 'pnl-pos' : 'pnl-neg'}">${UI.pnlStr(b.total_pnl)}</td>
        <td class="pnl-neg mono">−${parseFloat(b.max_drawdown).toFixed(1)}%</td>
        <td style="color:var(--text-secondary);font-size:11px;">${b.created_at?.split('T')[0] || b.created_at || '—'}</td>
      </tr>`).join('');
  },
};
