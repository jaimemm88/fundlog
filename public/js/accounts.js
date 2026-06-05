// ─── Cuentas ──────────────────────────────────────────────────────────────────
const Accounts = {
  _allAccounts: [],
  _activeFilter: '',

  async load() {
    const accounts = await API.accounts.list();
    Accounts._allAccounts = accounts;
    Accounts._setupFilters();
    Accounts._applyFilter();
    Portfolio.load(accounts);
  },

  _setupFilters() {
    document.querySelectorAll('.acc-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.acc-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Accounts._activeFilter = btn.dataset.type;
        Accounts._applyFilter();
      };
    });
  },

  _applyFilter() {
    const f = Accounts._activeFilter;
    const filtered = f
      ? Accounts._allAccounts.filter(a => a.type === f)
      : Accounts._allAccounts;
    Accounts._renderGrid(filtered);
  },

  TYPE_LABELS: { fase1: 'Fase 1', fase2: 'Fase 2', funded: 'Funded', propio: 'Capital Propio', live: 'Live', demo: 'Demo', prop: 'Prop Firm' },
  TYPE_COLORS: { fase1: 'pending', fase2: 'active', funded: 'win', propio: 'long' },

  _isPassed(a) {
    if (!a.profit_target || a.profit_target <= 0) return false;
    const pnl = a.balance - a.initial_balance;
    const target = a.initial_balance * a.profit_target / 100;
    return pnl >= target;
  },

  _renderGrid(accounts) {
    const grid = document.getElementById('accounts-grid');
    if (!accounts.length) {
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1;">No hay cuentas. Añade una abajo.</p>';
      return;
    }

    // Separar activas de pasadas
    const active = accounts.filter(a => !Accounts._isPassed(a));
    const passed = accounts.filter(a => Accounts._isPassed(a));

    // Renderizar pasadas en sección compacta
    const passedSection = document.getElementById('accounts-passed-section');
    const passedGrid    = document.getElementById('accounts-passed-grid');
    if (passed.length > 0 && passedSection && passedGrid) {
      passedSection.style.display = 'block';
      passedGrid.innerHTML = passed.map(a => {
        const pnl    = a.balance - a.initial_balance;
        const target = a.initial_balance * (a.profit_target / 100);
        const typeLabel = Accounts.TYPE_LABELS[a.type] || a.type;
        return `
          <div style="background:var(--bg-card);border:1px solid var(--green-light);border-left:3px solid var(--green-mid);border-radius:var(--radius);padding:14px 16px;display:flex;align-items:center;gap:14px;position:relative;">
            <div style="font-size:20px;">🏆</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                <span style="font-size:13px;font-weight:700;color:var(--text-primary);">${a.name}</span>
                <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;background:var(--green-light);color:var(--green);">${typeLabel} ✓</span>
              </div>
              <div style="font-size:11px;color:var(--text-secondary);">${a.broker || ''} · ${a.currency} ${Number(a.balance).toLocaleString('es-ES',{minimumFractionDigits:2})}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:14px;font-weight:700;color:var(--green-mid);">+${a.currency} ${Number(pnl).toLocaleString('es-ES',{minimumFractionDigits:2})}</div>
              <div style="font-size:10px;color:var(--text-secondary);">Obj: ${a.profit_target}% · ${(pnl/target*100).toFixed(0)}% completado</div>
            </div>
            <button class="btn-danger" style="position:absolute;top:8px;right:8px;padding:3px 7px;font-size:10px;opacity:0.5;" onclick="Accounts.delete(${a.id})" title="Eliminar"><i class="ti ti-trash"></i></button>
          </div>`;
      }).join('');
    } else if (passedSection) {
      passedSection.style.display = 'none';
    }

    // Solo mostrar activas en el grid principal
    accounts = active;
    grid.innerHTML = accounts.map(a => {
      const typeLabel = Accounts.TYPE_LABELS[a.type] || a.type;
      const typeColor = Accounts.TYPE_COLORS[a.type] || 'inactive';
      const pnl        = a.balance - a.initial_balance;
      const showProgress = (a.type === 'fase1' || a.type === 'fase2') && a.profit_target > 0;
      const targetAmt    = showProgress ? (a.initial_balance * a.profit_target / 100) : 0;
      const pct          = showProgress ? Math.min(100, Math.max(0, (pnl / targetAmt) * 100)) : 0;
      const nextLevel    = a.type === 'fase1' ? 'Fase 2' : 'Funded';
      const remaining    = showProgress ? Math.max(0, targetAmt - pnl) : 0;
      const barColor     = pct >= 100 ? 'green' : pct >= 60 ? '' : pct >= 30 ? 'amber' : 'red';

      const showLoss   = (a.type === 'fase1' || a.type === 'fase2') && a.max_loss > 0;
      const maxLossAmt = showLoss ? (a.initial_balance * a.max_loss / 100) : 0;
      const lossUsed   = showLoss ? Math.max(0, -pnl) : 0;  // pérdida acumulada (positivo)
      const lossPct    = showLoss ? Math.min(100, (lossUsed / maxLossAmt) * 100) : 0;
      const lossColor  = lossPct >= 90 ? 'red' : lossPct >= 70 ? 'amber' : 'green';
      const lossRemain = showLoss ? Math.max(0, maxLossAmt - lossUsed) : 0;

      return `
        <div class="acc-card">
          <div class="acc-card-actions">
            <button class="btn-edit" onclick="Accounts.openEdit(${a.id})" title="Editar"><i class="ti ti-pencil"></i></button>
            <button class="btn-danger" onclick="Accounts.delete(${a.id})" title="Eliminar"><i class="ti ti-trash"></i></button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <div style="font-size:14px;font-weight:700;margin-bottom:3px;">${a.name}</div>
              <div style="font-size:11px;color:var(--text-secondary);">${a.broker || '—'} · ${a.platform || '—'}</div>
            </div>
            <span class="acc-type-pill">${UI.pill(typeLabel, typeColor)}</span>
          </div>
          <div class="acc-balance">
            <div>
              <div class="tv-label">Balance actual</div>
              <div style="font-size:22px;font-weight:700;font-family:'JetBrains Mono';margin-top:2px;">${a.currency} ${Number(a.balance).toLocaleString('es-ES',{minimumFractionDigits:2})}</div>
            </div>
            <div style="text-align:right;">
              <div class="tv-label">P&L total</div>
              <div class="${UI.pnlClass(pnl)}" style="font-size:16px;font-weight:600;margin-top:2px;">${UI.pnlStr(pnl)}</div>
            </div>
          </div>

          ${showProgress ? `
          <div class="acc-progress-block">
            <div class="acc-progress-header">
              <span class="acc-progress-title">
                <i class="ti ti-flag-2" style="font-size:13px;"></i>
                Progreso hacia ${nextLevel}
              </span>
              <span class="acc-progress-pct ${pct >= 100 ? 'done' : ''}">${pct.toFixed(1)}%</span>
            </div>
            <div class="progress-wrap" style="height:8px;margin-bottom:8px;">
              <div class="progress-fill ${barColor}" style="width:${pct.toFixed(1)}%;transition:width 0.6s ease;"></div>
            </div>
            <div class="acc-progress-detail">
              <span style="color:var(--text-secondary);">Objetivo: <strong>${a.currency} ${Number(targetAmt).toLocaleString('es-ES',{minimumFractionDigits:2})}</strong> (${a.profit_target}%)</span>
              ${pct < 100
                ? `<span style="color:var(--text-secondary);">Faltan: <strong class="${pnl >= 0 ? '' : 'neg'}">${a.currency} ${Number(remaining).toLocaleString('es-ES',{minimumFractionDigits:2})}</strong></span>`
                : `<span style="color:var(--green-mid);font-weight:700;">✓ ¡Objetivo alcanzado!</span>`
              }
            </div>
          </div>` : ''}

          ${showLoss ? `
          <div class="acc-progress-block" style="margin-top:8px;background:${lossPct >= 70 ? 'rgba(216,90,48,0.05)' : 'transparent'};border-radius:var(--radius-sm);padding:${lossPct >= 70 ? '8px' : '0'};">
            <div class="acc-progress-header">
              <span class="acc-progress-title" style="color:var(--red,#D85A30);">
                <i class="ti ti-shield-x" style="font-size:13px;"></i>
                Límite de pérdida
              </span>
              <span class="acc-progress-pct ${lossPct >= 90 ? 'done' : ''}" style="color:${lossPct >= 70 ? 'var(--red,#D85A30)' : 'var(--text-secondary)'};">${lossPct.toFixed(1)}%</span>
            </div>
            <div class="progress-wrap" style="height:6px;margin-bottom:8px;">
              <div class="progress-fill ${lossColor}" style="width:${lossPct.toFixed(1)}%;transition:width 0.6s ease;"></div>
            </div>
            <div class="acc-progress-detail">
              <span style="color:var(--text-secondary);">Máx: <strong>${a.currency} ${Number(maxLossAmt).toLocaleString('es-ES',{minimumFractionDigits:2})}</strong> (-${a.max_loss}%)</span>
              ${lossPct < 100
                ? `<span style="color:var(--text-secondary);">Margen restante: <strong style="color:${lossRemain < maxLossAmt*0.3 ? 'var(--red,#D85A30)' : 'inherit'}">${a.currency} ${Number(lossRemain).toLocaleString('es-ES',{minimumFractionDigits:2})}</strong></span>`
                : `<span style="color:var(--red,#D85A30);font-weight:700;">⚠️ Límite alcanzado</span>`
              }
            </div>
          </div>` : ''}

          <div style="margin-top:12px;padding-top:12px;border-top:0.5px solid #EEF1F8;">
            ${UI.statRow('Balance inicial', `${a.currency} ${Number(a.initial_balance).toLocaleString('es-ES',{minimumFractionDigits:2})}`)}
            ${UI.statRow('Divisa', a.currency)}
          </div>
        </div>`;
    }).join('');
  },

  async openEdit(id) {
    const a = await API.accounts.get(id);
    document.getElementById('edit-acc-id').value       = a.id;
    document.getElementById('edit-acc-name').value     = a.name;
    document.getElementById('edit-acc-broker').value   = a.broker || '';
    document.getElementById('edit-acc-platform').value = a.platform || '';
    document.getElementById('edit-acc-type').value     = a.type || 'fase1';
    document.getElementById('edit-acc-target').value   = a.profit_target || '';
    document.getElementById('edit-acc-maxloss').value  = a.max_loss || '';
    document.getElementById('edit-acc-balance').value  = a.balance;
    document.getElementById('edit-acc-initial').value  = a.initial_balance;
    document.getElementById('edit-acc-currency').value = a.currency || 'EUR';
    // Mostrar/ocultar campos objetivo y pérdida máxima según tipo
    const showTarget = a.type === 'fase1' || a.type === 'fase2';
    document.getElementById('edit-acc-target-row').style.display = showTarget ? '' : 'none';
    document.getElementById('edit-acc-maxloss-row').style.display = showTarget ? '' : 'none';
    UI.openModal('accountModal');
  },

  async saveEdit() {
    const id = document.getElementById('edit-acc-id').value;
    const data = {
      name:            document.getElementById('edit-acc-name').value.trim(),
      broker:          document.getElementById('edit-acc-broker').value.trim(),
      platform:        document.getElementById('edit-acc-platform').value.trim(),
      type:            document.getElementById('edit-acc-type').value,
      profit_target:   parseFloat(document.getElementById('edit-acc-target').value) || 0,
      max_loss:        parseFloat(document.getElementById('edit-acc-maxloss').value) || 0,
      balance:         parseFloat(document.getElementById('edit-acc-balance').value) || 0,
      initial_balance: parseFloat(document.getElementById('edit-acc-initial').value) || 0,
      currency:        document.getElementById('edit-acc-currency').value,
    };
    if (!data.name) { UI.toast('El nombre es obligatorio', 'error'); return; }
    try {
      await API.accounts.update(id, data);
      UI.toast('Cuenta actualizada', 'success');
      UI.closeModal('accountModal');
      await Accounts.load();
      await App.loadAccounts();
    } catch(e) { UI.toast(e.message, 'error'); }
  },

  async save() {
    const data = {
      name:            document.getElementById('acc-name').value.trim(),
      broker:          document.getElementById('acc-broker').value.trim(),
      platform:        document.getElementById('acc-platform').value.trim(),
      initial_balance: document.getElementById('acc-balance').value,
      currency:        document.getElementById('acc-currency').value,
      type:            document.getElementById('acc-type').value,
      profit_target:   parseFloat(document.getElementById('acc-target').value) || 0,
      max_loss:        parseFloat(document.getElementById('acc-maxloss').value) || 0,
    };
    if (!data.name) { UI.toast('El nombre es obligatorio', 'error'); return; }
    try {
      await API.accounts.create(data);
      UI.toast('Cuenta añadida', 'success');
      ['acc-name','acc-broker','acc-platform','acc-balance'].forEach(id => document.getElementById(id).value = '');
      await Accounts.load();
      await App.loadAccounts(); // refresh selector
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async delete(id) {
    if (!confirm('¿Eliminar esta cuenta?')) return;
    await API.accounts.delete(id);
    UI.toast('Cuenta eliminada', 'success');
    await Accounts.load();
    await App.loadAccounts();
  },
};

// ─── Portfolio ────────────────────────────────────────────────────────────────
const Portfolio = {
  async load(accounts) {
    if (!accounts) accounts = await API.accounts.list();
    const monthly = await API.analysis.monthly({});
    Portfolio._renderMetrics(accounts);
    Portfolio._renderDoughnut(accounts);
    Portfolio._renderMonthly(monthly);
    Portfolio._renderTable(accounts);
  },

  _renderMetrics(accounts) {
    const total = accounts.reduce((s, a) => s + a.balance, 0);
    const totalInitial = accounts.reduce((s, a) => s + a.initial_balance, 0);
    const ytdPnl = total - totalInitial;
    document.getElementById('portfolio-metrics').innerHTML = `
      ${UI.metricCard('Valor total', UI.fmtCurrency(total), '', '')}
      ${UI.metricCard('Nº cuentas', accounts.length, accounts.filter(a=>a.type==='live').length + ' live', '')}
      ${UI.metricCard('P&L total (ops)', UI.pnlStr(ytdPnl), '', ytdPnl >= 0 ? 'pos' : 'neg')}
      ${UI.metricCard('Mayor cuenta', accounts.length ? UI.fmtCurrency(Math.max(...accounts.map(a=>a.balance))) : '—', '', '')}
    `;
  },

  _renderDoughnut(accounts) {
    const labels = accounts.map(a => a.name);
    const values = accounts.map(a => a.balance);
    const colors = ['#378ADD','#1D9E75','#EF9F27','#534AB7','#D85A30'];
    UI.chart('chartPortfolioDoughnut', {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { family: 'Sora', size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${UI.fmtCurrency(ctx.raw)}` } }
        }
      }
    });
  },

  _renderMonthly(monthly) {
    UI.chart('chartPortfolioMonthly', {
      type: 'bar',
      data: {
        labels: monthly.map(m => m.month),
        datasets: [{
          data: monthly.map(m => parseFloat(m.pnl.toFixed(2))),
          backgroundColor: monthly.map(m => m.pnl >= 0 ? 'rgba(29,158,117,0.7)' : 'rgba(216,90,48,0.7)'),
          borderRadius: 5,
        }]
      },
      options: {
        ...UI.chartDefaults,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => UI.pnlStr(ctx.raw) } } },
      }
    });
  },

  async _renderTable(accounts) {
    const rows = await Promise.all(accounts.map(async a => {
      const stats = await API.analysis.stats({ account_id: a.id }).catch(() => ({ total_pnl: 0, wins: 0, total: 0 }));
      const wr = stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) : '—';
      return `<tr>
        <td>${a.name}</td>
        <td style="color:var(--text-secondary)">${a.broker}</td>
        <td>${UI.pill({ live:'Live',demo:'Demo',prop:'Prop Firm' }[a.type] || a.type, a.type)}</td>
        <td class="mono">${a.currency} ${Number(a.balance).toLocaleString('es-ES',{minimumFractionDigits:2})}</td>
        <td class="${UI.pnlClass(stats.total_pnl)}">${UI.pnlStr(stats.total_pnl)}</td>
        <td class="mono">${wr}%</td>
      </tr>`;
    }));
    document.getElementById('portfolioTable').innerHTML = rows.join('');
  }
};
