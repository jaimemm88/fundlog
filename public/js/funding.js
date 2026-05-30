// ─── Funding ──────────────────────────────────────────────────────────────────
const Funding = {
  async load() {
    const [movements, summary] = await Promise.all([
      API.funding.list(),
      API.funding.summary(),
    ]);
    Funding._renderMetrics(summary);
    Funding._renderTable(movements);
    Funding._populateAccountSelect();
  },

  _renderMetrics(s) {
    document.getElementById('funding-metrics').innerHTML = `
      ${UI.metricCard('Total depositado', UI.fmtCurrency(s.total_deposited || 0), s.total_movements + ' movimientos', '')}
      ${UI.metricCard('Total retirado', UI.fmtCurrency(s.total_withdrawn || 0), 'Beneficios realizados', '')}
      ${UI.metricCard('Comisiones', '−' + UI.fmtCurrency(s.total_commissions || 0), 'Este año', 'neg')}
      ${UI.metricCard('Balance neto', UI.fmtCurrency((s.total_deposited || 0) - (s.total_withdrawn || 0)), 'Capital en cuentas', '')}
    `;
  },

  _renderTable(movements) {
    const typeLabels = { deposit: 'Depósito', withdrawal: 'Retiro', commission: 'Comisión' };
    document.getElementById('fundingBody').innerHTML = movements.map(m => `
      <tr>
        <td style="color:var(--text-secondary)">${UI.fmtDate(m.date)}</td>
        <td>${UI.pill(typeLabels[m.type] || m.type, m.type)}</td>
        <td style="font-size:11px;">${m.account_name || '—'}</td>
        <td class="${UI.pnlClass(m.amount)}">${UI.pnlStr(m.amount)}</td>
        <td style="color:var(--text-secondary);font-size:11px;">${m.notes || ''}</td>
        <td class="actions">
          <button class="btn-danger" onclick="Funding.delete(${m.id})"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty-state">No hay movimientos registrados</td></tr>';
  },

  async _populateAccountSelect() {
    const accounts = await API.accounts.list();
    const sel = document.getElementById('fund-account');
    sel.innerHTML = '<option value="">— Sin cuenta —</option>' +
      accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  },

  async save() {
    const typeRaw = document.getElementById('fund-type').value;
    let amount = parseFloat(document.getElementById('fund-amount').value) || 0;
    if (typeRaw === 'withdrawal' || typeRaw === 'commission') amount = -Math.abs(amount);

    const data = {
      type:       typeRaw,
      account_id: document.getElementById('fund-account').value || null,
      amount,
      date:       document.getElementById('fund-date').value,
      notes:      document.getElementById('fund-notes').value.trim(),
    };
    if (!data.date || !data.amount) { UI.toast('Importe y fecha son obligatorios', 'error'); return; }
    try {
      await API.funding.create(data);
      UI.toast('Movimiento registrado', 'success');
      document.getElementById('fund-amount').value = '';
      document.getElementById('fund-date').value = '';
      document.getElementById('fund-notes').value = '';
      Funding.load();
      App.loadAccounts();
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async delete(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await API.funding.delete(id);
    UI.toast('Movimiento eliminado', 'success');
    Funding.load();
    App.loadAccounts();
  },
};
