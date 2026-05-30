// ─── Gestión de Riesgo ────────────────────────────────────────────────────────
const Risk = {
  async load(accountId) {
    const [settings, stats, todayStats] = await Promise.all([
      API.risk.get({ account_id: accountId || '' }),
      API.analysis.stats({ account_id: accountId || '' }),
      API.analysis.stats({
        account_id: accountId || '',
        from: new Date().toISOString().split('T')[0],
        to:   new Date().toISOString().split('T')[0],
      }),
    ]);

    Risk._fillForm(settings);
    Risk._renderMetrics(settings, stats);
    Risk._renderStatus(settings, stats, todayStats);
  },

  _fillForm(s) {
    document.getElementById('risk-per-trade').value  = s.max_risk_per_trade;
    document.getElementById('risk-daily-dd').value   = s.max_daily_drawdown;
    document.getElementById('risk-total-dd').value   = s.max_total_drawdown;
    document.getElementById('risk-max-trades').value = s.max_open_trades;
    document.getElementById('risk-max-loss').value   = s.max_daily_loss || '';
  },

  _renderMetrics(s, stats) {
    const account = App.activeAccount;
    const dd = stats.max_drawdown || 0;
    document.getElementById('risk-metrics').innerHTML = `
      ${UI.metricCard('Riesgo por op.', s.max_risk_per_trade + '%', 'Configurado', '')}
      ${UI.metricCard('Drawdown máx.', dd.toFixed(1) + '%', `Límite: ${s.max_total_drawdown}%`, dd > s.max_total_drawdown * 0.8 ? 'neg' : '')}
      ${UI.metricCard('Balance actual', account ? UI.fmtCurrency(account.balance) : '—', '', '')}
      ${UI.metricCard('Ops. permitidas', s.max_open_trades, 'Simultáneas', '')}
    `;
  },

  _renderStatus(settings, stats, today) {
    const account = App.activeAccount;
    const balance = account?.balance || 0;
    const totalDD = stats.max_drawdown || 0;
    const todayPnl = today.total_pnl || 0;
    const todayLoss = todayPnl < 0 ? Math.abs(todayPnl) : 0;
    const maxDailyLoss = settings.max_daily_loss || (balance * settings.max_daily_drawdown / 100);

    const ddPct     = totalDD;
    const ddLimit   = settings.max_total_drawdown;
    const ddBar     = Math.min(100, (ddPct / ddLimit) * 100);
    const ddColor   = ddBar >= 80 ? 'red' : ddBar >= 50 ? 'amber' : 'green';

    const dayPct    = maxDailyLoss > 0 ? Math.min(100, (todayLoss / maxDailyLoss) * 100) : 0;
    const dayColor  = dayPct >= 80 ? 'red' : dayPct >= 50 ? 'amber' : 'green';

    document.getElementById('risk-status').innerHTML = `
      <div class="risk-indicator">
        <div class="risk-bar-row">
          <div class="risk-bar-label">
            <span>Drawdown total (límite ${ddLimit}%)</span>
            <span class="mono" style="color:${ddColor === 'red' ? 'var(--red-mid)' : ddColor === 'amber' ? 'var(--amber)' : 'var(--green-mid)'}">${ddPct.toFixed(1)}%</span>
          </div>
          <div class="progress-wrap" style="height:10px;"><div class="progress-fill ${ddColor}" style="width:${ddBar.toFixed(1)}%"></div></div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${ddBar >= 80 ? '⚠️ Zona de riesgo' : ddBar >= 50 ? 'Moderado' : 'Bajo control'}</div>
        </div>
        <div class="risk-bar-row">
          <div class="risk-bar-label">
            <span>Pérdida hoy (límite ${UI.fmtCurrency(maxDailyLoss)})</span>
            <span class="mono" style="color:${dayColor === 'red' ? 'var(--red-mid)' : 'var(--text-secondary)'}">${UI.fmtCurrency(todayLoss)}</span>
          </div>
          <div class="progress-wrap" style="height:10px;"><div class="progress-fill ${dayColor}" style="width:${dayPct.toFixed(1)}%"></div></div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${todayPnl >= 0 ? '✓ Sin pérdidas hoy' : `Pérdida del día: ${UI.pnlStr(todayPnl)}`}</div>
        </div>
        ${UI.statRow('Riesgo max. por operación', settings.max_risk_per_trade + '%')}
        ${UI.statRow('Máx. ops. simultáneas', settings.max_open_trades)}
        ${UI.statRow('P&L hoy', UI.pnlStr(todayPnl), todayPnl >= 0 ? 'pos' : 'neg')}
        ${UI.statRow('P&L total', UI.pnlStr(stats.total_pnl || 0), (stats.total_pnl || 0) >= 0 ? 'pos' : 'neg')}
      </div>`;
  },

  async save(accountId) {
    const data = {
      account_id:          accountId || null,
      max_risk_per_trade:  parseFloat(document.getElementById('risk-per-trade').value) || 1,
      max_daily_drawdown:  parseFloat(document.getElementById('risk-daily-dd').value) || 3,
      max_total_drawdown:  parseFloat(document.getElementById('risk-total-dd').value) || 5,
      max_open_trades:     parseInt(document.getElementById('risk-max-trades').value) || 5,
      max_daily_loss:      parseFloat(document.getElementById('risk-max-loss').value) || 0,
    };
    try {
      await API.risk.save(data);
      UI.toast('Configuración de riesgo guardada', 'success');
      Risk.load(accountId);
    } catch (e) { UI.toast(e.message, 'error'); }
  },
};
