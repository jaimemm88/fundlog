// ─── Progress Tracker ─────────────────────────────────────────────────────────
const Progress = {
  async load(accountId) {
    const [goals, stats] = await Promise.all([
      API.goals.list(),
      API.analysis.stats({ account_id: accountId || '' }),
    ]);
    Progress._renderMetrics(goals);
    Progress._renderGoals(goals, stats);
  },

  _renderMetrics(goals) {
    const active    = goals.filter(g => g.status === 'active').length;
    const completed = goals.filter(g => g.status === 'completed').length;
    const pct = goals.length > 0 ? Math.round(completed / goals.length * 100) : 0;
    document.getElementById('progress-metrics').innerHTML = `
      ${UI.metricCard('Objetivos totales', goals.length, '', '')}
      ${UI.metricCard('Completados', completed, pct + '% del total', 'pos')}
      ${UI.metricCard('Activos', active, 'En progreso', '')}
      ${UI.metricCard('Tasa de éxito', pct + '%', goals.length > 0 ? completed + ' de ' + goals.length : '—', pct >= 50 ? 'pos' : '')}
    `;
  },

  _renderGoals(goals, stats) {
    const list = document.getElementById('goals-list');
    if (!goals.length) {
      list.innerHTML = '<p class="empty-state">No hay objetivos. Crea uno.</p>';
      return;
    }

    const metricLabels = { pnl: 'P&L (€)', winrate: 'Win Rate (%)', drawdown: 'Drawdown (%)', trades: 'Operaciones' };
    const symbol = { pnl: '$', winrate: '%', drawdown: '%', trades: '' };

    list.innerHTML = goals.map(g => {
      const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
      const sym = symbol[g.metric] || '';
      const statusLabel = { active: 'Activo', completed: '✓ Completado', failed: '✗ Fallido' }[g.status] || g.status;

      return `
        <div style="margin-bottom:18px;padding-bottom:18px;border-bottom:0.5px solid #EEF1F8;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div>
              <div style="font-size:12.5px;font-weight:600;margin-bottom:3px;">${g.name}</div>
              <div style="font-size:10.5px;color:var(--text-secondary);">${metricLabels[g.metric] || g.metric}${g.deadline ? ' · Límite: ' + UI.fmtDate(g.deadline) : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${UI.pill(statusLabel, g.status)}
              <button class="btn-edit" style="font-size:10px;" onclick="Progress.markComplete(${g.id},${g.status === 'completed' ? 0 : 1})">
                <i class="ti ti-${g.status === 'completed' ? 'rotate-clockwise' : 'check'}"></i>
              </button>
              <button class="btn-danger" onclick="Progress.delete(${g.id})"><i class="ti ti-trash"></i></button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;">
            <span style="color:var(--text-secondary);">Progreso</span>
            <span class="mono">${sym}${g.current_value} / ${sym}${g.target_value} (${pct.toFixed(1)}%)</span>
          </div>
          ${UI.progressBar(g.current_value, g.target_value)}
        </div>`;
    }).join('');
  },

  async save() {
    const data = {
      name:          document.getElementById('goal-name').value.trim(),
      metric:        document.getElementById('goal-metric').value,
      target_value:  document.getElementById('goal-target').value,
      current_value: document.getElementById('goal-current').value,
      deadline:      document.getElementById('goal-deadline').value,
    };
    if (!data.name || !data.target_value) { UI.toast('Nombre y valor objetivo son obligatorios', 'error'); return; }
    try {
      await API.goals.create(data);
      UI.toast('Objetivo creado', 'success');
      ['goal-name','goal-target','goal-current','goal-deadline'].forEach(id => document.getElementById(id).value = '');
      Progress.load(App.activeAccountId);
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async markComplete(id, complete) {
    const goals = await API.goals.list();
    const g = goals.find(x => x.id === id);
    if (!g) return;
    await API.goals.update(id, { ...g, status: complete ? 'completed' : 'active' });
    Progress.load(App.activeAccountId);
  },

  async delete(id) {
    if (!confirm('¿Eliminar este objetivo?')) return;
    await API.goals.delete(id);
    UI.toast('Objetivo eliminado', 'success');
    Progress.load(App.activeAccountId);
  },
};
