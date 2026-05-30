// ─── Operaciones ──────────────────────────────────────────────────────────────
const Trades = {
  _data: [],

  async load(accountId) {
    const params = { account_id: accountId || '' };
    // Apply filters
    const result = document.getElementById('opsFilterResult').value;
    const pair   = document.getElementById('opsFilterPair').value;
    const month  = document.getElementById('opsFilterMonth').value;
    if (result) params.result = result;
    if (pair)   params.pair   = pair;
    if (month)  { params.from = month + '-01'; params.to = month + '-31'; }

    const [trades, summary] = await Promise.all([
      API.trades.list(params),
      API.analysis.stats({ account_id: accountId || '' }),
    ]);
    Trades._data = trades;
    Trades._renderMetrics(summary);
    Trades._renderTable(trades);
    Trades._populatePairFilter(trades);
  },

  _renderMetrics(s) {
    const wr = s.total > 0 ? (s.wins / s.total * 100).toFixed(1) : 0;
    document.getElementById('ops-metrics').innerHTML = `
      ${UI.metricCard('Total operaciones', s.total, 'Histórico completo')}
      ${UI.metricCard('Ganadoras', s.wins, wr + '% win rate', 'pos')}
      ${UI.metricCard('P&L total', UI.pnlStr(s.total_pnl), '', s.total_pnl >= 0 ? 'pos' : 'neg')}
      ${UI.metricCard('Media por op.', UI.pnlStr(s.total_pnl / (s.total || 1)), '', (s.total_pnl / (s.total || 1)) >= 0 ? 'pos' : 'neg')}
    `;
  },

  _renderTable(trades) {
    const body = document.getElementById('tradesBody');
    const empty = document.getElementById('tradesEmpty');
    if (!trades.length) {
      body.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    body.innerHTML = trades.map(t => `
      <tr>
        <td style="color:var(--text-secondary)">${UI.fmtDate(t.date)}</td>
        <td class="mono">${t.pair}</td>
        <td>${UI.pill(t.type === 'long' ? 'Long' : 'Short', t.type)}</td>
        <td class="mono">${t.entry_price || '—'}</td>
        <td class="mono">${t.exit_price || '—'}</td>
        <td class="mono">${t.size ? t.size + ' lot' : '—'}</td>
        <td style="color:var(--text-secondary);font-size:11px;">${t.strategy_name || '—'}</td>
        <td style="font-size:11px;">${UI.sessionLabel(t.session)}</td>
        <td class="${UI.pnlClass(t.pnl)}">${UI.pnlStr(t.pnl)}</td>
        <td>${UI.pill(t.result === 'win' ? 'Win' : 'Loss', t.result)}</td>
        <td class="actions">
          <button class="btn-edit" onclick="Trades.edit(${t.id})"><i class="ti ti-pencil"></i></button>
          <button class="btn-danger" onclick="Trades.delete(${t.id})" style="margin-left:4px;"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  },

  _populatePairFilter(trades) {
    const pairs = [...new Set(trades.map(t => t.pair))].sort();
    const sel = document.getElementById('opsFilterPair');
    const current = sel.value;
    sel.innerHTML = '<option value="">Todos los pares</option>' +
      pairs.map(p => `<option value="${p}"${p === current ? ' selected' : ''}>${p}</option>`).join('');
  },

  async edit(id) {
    const t = await API.trades.get(id);
    TradeModal.open(t);
  },

  async delete(id) {
    if (!confirm('¿Eliminar esta operación?')) return;
    try {
      await API.trades.delete(id);
      UI.toast('Operación eliminada', 'success');
      App.reload();
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  },
};
