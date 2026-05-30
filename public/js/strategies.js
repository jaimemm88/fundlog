// ─── Estrategias ──────────────────────────────────────────────────────────────
const Strategies = {
  async load() {
    const strategies = await API.strategies.list();
    Strategies._render(strategies);
  },

  _render(strategies) {
    const grid = document.getElementById('strategies-grid');
    if (!strategies.length) {
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1;">No hay estrategias. Crea una abajo.</p>';
      return;
    }
    grid.innerHTML = strategies.map(s => {
      const st = s.stats;
      const wr = st && st.total > 0 ? (st.wins / st.total * 100).toFixed(1) : 0;
      const pnl = st?.total_pnl || 0;
      const avgW = st?.avg_win ? UI.fmtCurrency(st.avg_win) : '—';
      const avgL = st?.avg_loss ? UI.fmtCurrency(Math.abs(st.avg_loss)) : '—';
      const statusCls = s.status === 'active' ? 'active' : 'paused';
      const statusLbl = s.status === 'active' ? 'Activa' : 'Pausada';

      return `
        <div class="strat-card">
          <div class="strat-actions">
            <button class="btn-edit" onclick="Strategies.openEdit(${s.id})" title="Editar"><i class="ti ti-pencil"></i></button>
            <button class="btn-edit" onclick="Strategies.toggleStatus(${s.id},'${s.status}')" title="${s.status === 'active' ? 'Pausar' : 'Activar'}">
              <i class="ti ti-${s.status === 'active' ? 'player-pause' : 'player-play'}"></i>
            </button>
            <button class="btn-danger" onclick="Strategies.delete(${s.id})" title="Eliminar"><i class="ti ti-trash"></i></button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${s.name}</div>
              ${UI.pill(statusLbl, statusCls)}
            </div>
            <div class="${pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}" style="font-size:18px;font-weight:500;">${UI.pnlStr(pnl)}</div>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5;">${s.description || 'Sin descripción'}</div>
          ${UI.statRow('Mercado', s.market || '—')}
          ${UI.statRow('Timeframe', s.timeframe || '—')}
          ${UI.statRow('Objetivo R:R', s.target_rr || '—')}
          ${UI.statRow('Operaciones', st?.total || 0)}
          ${UI.statRow('Win rate', wr + '%', wr >= 50 ? 'pos' : 'neg')}
          ${UI.statRow('Media ganancia', avgW, 'pos')}
          ${UI.statRow('Media pérdida', avgL, 'neg')}
        </div>`;
    }).join('');
  },

  async save() {
    const data = {
      name:        document.getElementById('strat-name').value.trim(),
      market:      document.getElementById('strat-market').value.trim(),
      timeframe:   document.getElementById('strat-tf').value.trim(),
      target_rr:   document.getElementById('strat-rr').value.trim(),
      description: document.getElementById('strat-desc').value.trim(),
    };
    if (!data.name) { UI.toast('El nombre es obligatorio', 'error'); return; }
    try {
      await API.strategies.create(data);
      UI.toast('Estrategia guardada', 'success');
      document.getElementById('strat-name').value = '';
      document.getElementById('strat-market').value = '';
      document.getElementById('strat-tf').value = '';
      document.getElementById('strat-rr').value = '';
      document.getElementById('strat-desc').value = '';
      Strategies.load();
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async openEdit(id) {
    const s = await API.strategies.get(id);
    document.getElementById('edit-strat-id').value     = s.id;
    document.getElementById('edit-strat-name').value   = s.name;
    document.getElementById('edit-strat-market').value = s.market || '';
    document.getElementById('edit-strat-tf').value     = s.timeframe || '';
    document.getElementById('edit-strat-rr').value     = s.target_rr || '';
    document.getElementById('edit-strat-desc').value   = s.description || '';
    document.getElementById('edit-strat-status').value = s.status || 'active';
    UI.openModal('stratModal');
  },

  async saveEdit() {
    const id   = document.getElementById('edit-strat-id').value;
    const data = {
      name:        document.getElementById('edit-strat-name').value.trim(),
      market:      document.getElementById('edit-strat-market').value.trim(),
      timeframe:   document.getElementById('edit-strat-tf').value.trim(),
      target_rr:   document.getElementById('edit-strat-rr').value.trim(),
      description: document.getElementById('edit-strat-desc').value.trim(),
      status:      document.getElementById('edit-strat-status').value,
    };
    if (!data.name) { UI.toast('El nombre es obligatorio', 'error'); return; }
    try {
      await API.strategies.update(id, data);
      UI.toast('Estrategia actualizada', 'success');
      UI.closeModal('stratModal');
      Strategies.load();
    } catch(e) { UI.toast(e.message, 'error'); }
  },

  async toggleStatus(id, current) {
    const next = current === 'active' ? 'paused' : 'active';
    const s = await API.strategies.get(id);
    await API.strategies.update(id, { ...s, status: next });
    Strategies.load();
  },

  async delete(id) {
    if (!confirm('¿Eliminar esta estrategia? Las operaciones asociadas no se eliminarán.')) return;
    await API.strategies.delete(id);
    UI.toast('Estrategia eliminada', 'success');
    Strategies.load();
  },
};
