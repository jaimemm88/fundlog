// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = {
  async load(accountId) {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    const [summary, recent, equity, strategies, goals, accounts] = await Promise.all([
      API.analysis.stats({ account_id: accountId || '', from }),
      API.trades.list({ account_id: accountId || '', limit: 6 }),
      API.analysis.equity({ account_id: accountId || '' }),
      API.strategies.list(),
      API.goals.list(),
      API.accounts.list(),
    ]);

    Dashboard._renderMetrics(summary, accounts);
    Dashboard._renderRecentTrades(recent);
    Dashboard._renderEquityChart(equity);
    Dashboard._renderStrategies(strategies);
    Dashboard._renderGoals(goals);

    // Update sub header
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    document.getElementById('resumen-sub').textContent = `FundLog · ${months[now.getMonth()]} ${now.getFullYear()}`;
  },

  _renderMetrics(s, accounts = []) {
    const wr = s.total > 0 ? (s.wins / s.total * 100).toFixed(1) : 0;
    const pf = s.gross_loss > 0 ? (s.gross_profit / s.gross_loss).toFixed(2) : '—';

    const totalBalance = App.activeAccount
      ? App.activeAccount.balance
      : App._accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    // Construir desglose por tipo de cuenta
    const TYPE_LABELS = { fase1: 'Fase 1', fase2: 'Fase 2', funded: 'Funded', propio: 'Capital propio', live: 'Live', demo: 'Demo', prop: 'Prop' };
    let balanceSubHtml = '';
    if (!App.activeAccount && accounts.length > 0) {
      const groups = {};
      accounts.forEach(a => {
        const label = TYPE_LABELS[a.type] || a.type;
        if (!groups[label]) groups[label] = 0;
        groups[label] += a.balance || 0;
      });
      const parts = Object.entries(groups).map(([label, bal]) =>
        `<span style="white-space:nowrap;"><span style="opacity:0.6;">${label}</span> <strong style="color:var(--text-primary);">$${Math.round(bal).toLocaleString('es-ES')}</strong></span>`
      );
      balanceSubHtml = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;font-size:10.5px;">${parts.join('<span style="opacity:0.3;">·</span>')}</div>`;
    } else if (App.activeAccount) {
      balanceSubHtml = App.activeAccount.name;
    }

    document.getElementById('resumen-metrics').innerHTML = `
      <div class="metric" style="grid-column:span 1;">
        <div class="metric-label">Balance total</div>
        <div class="metric-val mono" id="cnt-balance">$0</div>
        ${balanceSubHtml}
      </div>
      ${UI.metricCard('P&L este mes', '<span id="cnt-pnl">$0</span>', `↑ ${s.total} operaciones`, s.total_pnl >= 0 ? 'pos' : 'neg')}
      ${UI.metricCard('Win rate', '<span id="cnt-wr">0</span>%', s.wins + ' ganadoras', 'pos')}
      ${UI.metricCard('Profit Factor', pf, s.max_drawdown ? `DD: ${s.max_drawdown.toFixed(1)}%` : '', '')}
    `;
    // Animar contadores
    setTimeout(() => {
      UI.countUp(document.getElementById('cnt-balance'), totalBalance, 900, '$');
      UI.countUp(document.getElementById('cnt-pnl'),    Math.abs(s.total_pnl || 0), 800, s.total_pnl >= 0 ? '+$' : '-$');
      UI.countUp(document.getElementById('cnt-wr'),     parseFloat(wr), 700, '', '');
    }, 150);
  },

  _renderRecentTrades(trades) {
    if (!trades.length) {
      document.getElementById('resumen-trades').innerHTML = '<p class="empty-state">No hay operaciones este mes.<br>¡Añade tu primera operación!</p>';
      return;
    }
    const rows = trades.map(t => `
      <tr>
        <td class="mono">${t.pair}</td>
        <td>${UI.pill(t.type === 'long' ? 'Long' : 'Short', t.type)}</td>
        <td class="${UI.pnlClass(t.pnl)}">${UI.pnlStr(t.pnl)}</td>
        <td style="color:var(--text-secondary)">${UI.fmtDate(t.date)}</td>
      </tr>`).join('');
    document.getElementById('resumen-trades').innerHTML = `
      <table class="tv-table">
        <thead><tr><th>Par</th><th>Tipo</th><th>P&L</th><th>Fecha</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  _equityChart: null,
  _renderEquityChart(data) {
    const labels = data.map(d => {
      const [,m,dd] = d.date.split('-');
      return `${parseInt(dd)}/${parseInt(m)}`;
    });
    const values = data.map(d => parseFloat(d.equity.toFixed(2)));

    UI.chart('chartEquity', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#378ADD',
          backgroundColor: 'rgba(55,138,221,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#378ADD',
        }]
      },
      options: {
        ...UI.chartDefaults,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => UI.pnlStr(ctx.raw) }
        }},
      }
    });
  },

  _renderStrategies(strategies) {
    const active = strategies.filter(s => s.status === 'active').slice(0, 4);
    if (!active.length) {
      document.getElementById('resumen-strategies').innerHTML = '<p class="empty-state">No hay estrategias activas</p>';
      return;
    }
    document.getElementById('resumen-strategies').innerHTML = active.map(s => {
      const pnl = s.stats?.total_pnl || 0;
      return UI.statRow(s.name, UI.pnlStr(pnl), pnl >= 0 ? 'pos' : 'neg');
    }).join('');
  },

  _renderGoals(goals) {
    const active = goals.filter(g => g.status === 'active').slice(0, 3);
    if (!active.length) {
      document.getElementById('resumen-goals').innerHTML = '<p class="empty-state">No hay objetivos activos</p>';
      return;
    }
    document.getElementById('resumen-goals').innerHTML = active.map(g => {
      const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
      const symbol = g.metric === 'pnl' ? '€' : g.metric === 'winrate' || g.metric === 'drawdown' ? '%' : '';
      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px;">
            <span style="color:var(--text-secondary)">${g.name}</span>
            <span class="mono">${symbol}${g.current_value} / ${symbol}${g.target_value}</span>
          </div>
          ${UI.progressBar(g.current_value, g.target_value)}
        </div>`;
    }).join('');
  }
};
