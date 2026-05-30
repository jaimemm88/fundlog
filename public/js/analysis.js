// ─── Análisis ─────────────────────────────────────────────────────────────────
const Analysis = {
  async load(accountId) {
    const p = { account_id: accountId || '' };
    const [stats, byPair, bySession, byWeekday, equity, byStrategy, allTrades] = await Promise.all([
      API.analysis.stats(p),
      API.analysis.byPair(p),
      API.analysis.bySession(p),
      API.analysis.byWeekday(p),
      API.analysis.equity(p),
      API.analysis.byStrategy(p),
      API.trades.list(p),
    ]);

    Analysis._renderMetrics(stats);
    Analysis._renderEquityWithDrawdown(equity);
    Analysis._renderByPair(byPair);
    Analysis._renderBySession(bySession);
    Analysis._renderByWeekday(byWeekday);
    Analysis._renderPnlDistribution(allTrades);
    Analysis._renderHeatmap(equity);
    Analysis._renderKeyStats(stats);
    Analysis._renderByStrategy(byStrategy);
  },

  _renderMetrics(s) {
    const pf     = s.gross_loss > 0 ? (s.gross_profit / s.gross_loss).toFixed(2) : '∞';
    const sharpe = s.sharpe ? s.sharpe.toFixed(2) : '—';
    const wr     = s.total > 0 ? (s.wins / s.total * 100).toFixed(1) : 0;
    document.getElementById('analysis-metrics').innerHTML = `
      ${UI.metricCard('Profit Factor', pf,    pf > 1 ? '↑ Rentable' : '↓ Por debajo de 1', pf > 1.5 ? 'pos' : 'neg')}
      ${UI.metricCard('Sharpe Ratio', sharpe, sharpe > 1 ? '↑ Bueno' : '', sharpe > 1 ? 'pos' : '')}
      ${UI.metricCard('Win Rate', wr + '%',   s.wins + ' / ' + s.total + ' ops.', wr >= 50 ? 'pos' : 'neg')}
      ${UI.metricCard('Expectativa', UI.pnlStr((s.total_pnl||0)/(s.total||1)), 'Por operación', (s.total_pnl||0) >= 0 ? 'pos' : 'neg')}
    `;
  },

  // ── Equity + Drawdown ─────────────────────────────────────────────────────
  _renderEquityWithDrawdown(data) {
    if (!data.length) return;
    const labels  = data.map(d => { const [,m,dd] = d.date.split('-'); return `${parseInt(dd)}/${parseInt(m)}`; });
    const equity  = data.map(d => parseFloat(d.equity.toFixed(2)));

    // Calcular peak y drawdown
    const peaks = [];
    const drawdowns = [];
    let peak = 0;
    for (const e of equity) {
      if (e > peak) peak = e;
      peaks.push(peak);
      drawdowns.push(peak > 0 ? -((peak - e) / peak * 100) : 0);
    }

    UI.chart('chartEquityFull', {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Equity',
            data: equity,
            borderColor: '#378ADD',
            backgroundColor: 'rgba(55,138,221,0.06)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Peak',
            data: peaks,
            borderColor: 'rgba(55,138,221,0.25)',
            borderDash: [4, 4],
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: 'Drawdown %',
            data: drawdowns,
            borderColor: 'rgba(216,90,48,0.7)',
            backgroundColor: 'rgba(216,90,48,0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 1.5,
            yAxisID: 'y2',
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.datasetIndex === 0) return `Equity: ${UI.pnlStr(ctx.raw)}`;
                if (ctx.datasetIndex === 1) return `Peak: ${UI.pnlStr(ctx.raw)}`;
                return `Drawdown: ${ctx.raw.toFixed(2)}%`;
              }
            }
          }
        },
        scales: {
          x:  { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#6B7A99', maxTicksLimit: 12 } },
          y:  { position: 'left',  grid: { color: '#EEF1F8' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#378ADD' } },
          y2: { position: 'right', grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#D85A30', callback: v => v.toFixed(1) + '%' }, max: 0 },
        }
      }
    });
  },

  // ── P&L por par ───────────────────────────────────────────────────────────
  _renderByPair(data) {
    if (!data.length) return;
    const sorted = [...data].sort((a, b) => b.pnl - a.pnl);
    UI.chart('chartByPair', {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.pair),
        datasets: [{
          data: sorted.map(d => parseFloat(d.pnl.toFixed(2))),
          backgroundColor: sorted.map(d => d.pnl >= 0 ? 'rgba(29,158,117,0.75)' : 'rgba(216,90,48,0.75)'),
          borderRadius: 5, borderSkipped: false,
        }]
      },
      options: {
        ...UI.chartDefaults, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => UI.pnlStr(ctx.raw) } } },
      }
    });
  },

  // ── Por sesión ────────────────────────────────────────────────────────────
  _renderBySession(data) {
    const sessions = [
      { key: 'tokyo',   label: '🇯🇵 Tokio', color: 'rgba(124,111,205,0.75)' },
      { key: 'london',  label: '🇬🇧 Londres', color: 'rgba(55,138,221,0.75)' },
      { key: 'overlap', label: '🔀 Overlap', color: 'rgba(29,158,117,0.75)' },
      { key: 'ny',      label: '🇺🇸 NY', color: 'rgba(224,122,90,0.75)' },
    ];
    const map    = Object.fromEntries(data.map(d => [d.session, d]));
    const values = sessions.map(s => parseFloat((map[s.key]?.pnl || 0).toFixed(2)));
    UI.chart('chartBySession', {
      type: 'bar',
      data: {
        labels: sessions.map(s => s.label),
        datasets: [{
          data: values,
          backgroundColor: sessions.map(s => s.color),
          borderRadius: 6, borderSkipped: false,
        }]
      },
      options: {
        ...UI.chartDefaults,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => UI.pnlStr(ctx.raw) } } },
      }
    });
  },

  // ── Por día semana ────────────────────────────────────────────────────────
  _renderByWeekday(data) {
    const days   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const map    = Object.fromEntries(data.map(d => [d.dow, parseFloat((d.pnl||0).toFixed(2))]));
    const values = [1,2,3,4,5,6,0].map(i => map[i] || 0);
    UI.chart('chartByWeekday', {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          data: values,
          backgroundColor: values.map(v => v >= 0 ? 'rgba(55,138,221,0.75)' : 'rgba(216,90,48,0.75)'),
          borderRadius: 5, borderSkipped: false,
        }]
      },
      options: {
        ...UI.chartDefaults,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => UI.pnlStr(ctx.raw) } } },
      }
    });
  },

  // ── Distribución de P&L (histograma) ─────────────────────────────────────
  _renderPnlDistribution(trades) {
    if (!trades.length) return;
    const pnls = trades.map(t => parseFloat(t.pnl));
    const min  = Math.floor(Math.min(...pnls) / 50) * 50;
    const max  = Math.ceil(Math.max(...pnls) / 50) * 50;
    const bins = [];
    const step = Math.max(25, Math.round((max - min) / 20 / 25) * 25);

    for (let b = min; b < max; b += step) {
      const count = pnls.filter(p => p >= b && p < b + step).length;
      bins.push({ label: `${b >= 0 ? '+' : ''}$${b}`, value: count, pnl: b });
    }

    UI.chart('chartPnlDist', {
      type: 'bar',
      data: {
        labels: bins.map(b => b.label),
        datasets: [{
          data: bins.map(b => b.value),
          backgroundColor: bins.map(b => b.pnl >= 0 ? 'rgba(29,158,117,0.75)' : 'rgba(216,90,48,0.75)'),
          borderRadius: 4, borderSkipped: false,
        }]
      },
      options: {
        ...UI.chartDefaults,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw + ' trades' } } },
        scales: {
          x: { ...UI.chartDefaults.scales?.x, ticks: { font: { family: 'JetBrains Mono', size: 9 }, color: '#6B7A99', maxRotation: 45 } },
          y: { ...UI.chartDefaults.scales?.y, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#6B7A99', stepSize: 1 } },
        }
      }
    });
  },

  // ── Heatmap mensual ───────────────────────────────────────────────────────
  _renderHeatmap(equityData) {
    const el = document.getElementById('analysisHeatmap');
    if (!el) return;

    // Construir mapa de fecha → pnl diario
    const dailyMap = {};
    let prev = 0;
    for (const d of equityData) {
      dailyMap[d.date] = d.pnl;
      prev = d.equity;
    }

    // Últimos 6 meses
    const today   = new Date();
    const months  = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const maxAbs = Math.max(...Object.values(dailyMap).map(Math.abs), 1);

    const intensity = (pnl) => {
      const ratio = Math.min(1, Math.abs(pnl) / maxAbs);
      if (pnl > 0) {
        const g = Math.round(80 + ratio * 78);
        return `rgba(29,${g+40},${g},${0.3 + ratio * 0.6})`;
      } else if (pnl < 0) {
        const r = Math.round(160 + ratio * 56);
        return `rgba(${r},${Math.round(60 - ratio * 30)},${Math.round(48 - ratio * 20)},${0.3 + ratio * 0.6})`;
      }
      return 'rgba(221,227,239,0.5)';
    };

    let html = '<div class="heatmap-wrap"><div class="heatmap-months">';
    for (const { year, month } of months) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      html += `<div class="heatmap-month">
        <div class="heatmap-month-label">${monthNames[month]}</div>
        <div class="heatmap-grid">`;

      // Padding primer día
      const firstDow = new Date(year, month, 1).getDay();
      const pad = firstDow === 0 ? 6 : firstDow - 1;
      for (let i = 0; i < pad; i++) html += `<div class="heatmap-cell" style="background:transparent;"></div>`;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const pnl     = dailyMap[dateStr];
        const isFuture = new Date(dateStr) > today;
        const bg      = isFuture ? 'rgba(221,227,239,0.2)' : pnl !== undefined ? intensity(pnl) : 'rgba(221,227,239,0.4)';
        const tip     = pnl !== undefined ? `${UI.fmtDate(dateStr)}: ${UI.pnlStr(pnl)}` : UI.fmtDate(dateStr);
        html += `<div class="heatmap-cell" style="background:${bg};" data-tip="${tip}"></div>`;
      }
      html += `</div></div>`;
    }
    html += `</div>
      <div class="heatmap-legend">
        <span>Menos</span>
        <div class="heatmap-legend-cells">
          <span style="background:rgba(216,90,48,0.8);"></span>
          <span style="background:rgba(216,90,48,0.45);"></span>
          <span style="background:rgba(221,227,239,0.5);"></span>
          <span style="background:rgba(29,158,117,0.45);"></span>
          <span style="background:rgba(29,158,117,0.85);"></span>
        </div>
        <span>Más</span>
      </div>
    </div>`;
    el.innerHTML = html;
  },

  // ── Estadísticas clave ────────────────────────────────────────────────────
  _renderKeyStats(s) {
    const wr = s.total > 0 ? (s.wins / s.total * 100).toFixed(1) : 0;
    document.getElementById('analysis-key-stats').innerHTML = `
      ${UI.statRow('Total operaciones', s.total)}
      ${UI.statRow('Win rate', wr + '%', parseFloat(wr) >= 50 ? 'pos' : 'neg')}
      ${UI.statRow('Mejor operación', UI.pnlStr(s.best_trade  || 0), 'pos')}
      ${UI.statRow('Peor operación',  UI.pnlStr(s.worst_trade || 0), 'neg')}
      ${UI.statRow('Racha ganadora máx.', (s.max_win_streak  || 0) + ' ops.')}
      ${UI.statRow('Racha perdedora máx.', (s.max_loss_streak || 0) + ' ops.', 'neg')}
      ${UI.statRow('Drawdown máximo', s.max_drawdown ? s.max_drawdown.toFixed(1) + '%' : '0%', 'neg')}
      ${UI.statRow('P&L total', UI.pnlStr(s.total_pnl || 0), (s.total_pnl||0) >= 0 ? 'pos' : 'neg')}
      ${UI.statRow('Media ganancia', UI.pnlStr(s.avg_win  || 0), 'pos')}
      ${UI.statRow('Media pérdida',  UI.pnlStr(s.avg_loss || 0), 'neg')}
    `;
  },

  // ── Por estrategia ────────────────────────────────────────────────────────
  _renderByStrategy(data) {
    if (!data.length) return;
    const sorted = [...data].filter(d => d.strategy).sort((a, b) => b.pnl - a.pnl);
    UI.chart('chartByStrategy', {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.strategy || 'Sin estrategia'),
        datasets: [{
          data: sorted.map(d => parseFloat((d.pnl||0).toFixed(2))),
          backgroundColor: sorted.map(d => d.pnl >= 0 ? 'rgba(83,74,183,0.75)' : 'rgba(216,90,48,0.75)'),
          borderRadius: 5, borderSkipped: false,
        }]
      },
      options: {
        ...UI.chartDefaults, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => UI.pnlStr(ctx.raw) } } },
      }
    });
  },
};
