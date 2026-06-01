// ─── App — Orquestador principal ──────────────────────────────────────────────
const App = {
  activeSection:  'resumen',
  activeAccountId: null,
  activeAccount:   null,
  _accounts:       [],

  async init() {
    Theme.init();
    UI.initInteractions();
    MarketSession.init();
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission(), 3000);
    }
    // Verificar estado del plan / trial
    App.checkPlanStatus();
    await App.loadAccounts();
    App._setupNav();
    App._setupTradeModal();
    App._setupFilters();
    App._setupMisc();
    App.navigate('resumen');
    // Comprobar alertas de riesgo al arrancar y cada 5 minutos
    App.checkRiskAlerts();
    setInterval(App.checkRiskAlerts, 5 * 60 * 1000);
  },

  // ── Accounts selector ───────────────────────────────────────────────────────
  async loadAccounts() {
    const accounts = await API.accounts.list().catch(() => []);
    App._accounts = accounts;

    const sel = document.getElementById('accountSelect');
    sel.innerHTML = '<option value="">Todas las cuentas</option>' +
      accounts.map(a => `<option value="${a.id}"${a.id == App.activeAccountId ? ' selected' : ''}>${a.name}</option>`).join('');

    const active = accounts.find(a => a.id == App.activeAccountId) || null;
    App.activeAccount   = active;
    App.activeAccountId = active?.id || null;
    document.getElementById('activeAccountLabel').textContent = active?.name || 'Todas las cuentas';
    sel.value = active?.id || '';

    // Populate trade modal account select
    const tradeSel = document.getElementById('trade-account');
    tradeSel.innerHTML = '<option value="">— Sin cuenta —</option>' +
      accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  _setupNav() {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        App.navigate(section);
        // Close sidebar on mobile
        if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
      });
    });

    document.getElementById('accountSelect').addEventListener('change', e => {
      App.activeAccountId = e.target.value || null;
      App.activeAccount = App._accounts.find(a => a.id == App.activeAccountId) || null;
      document.getElementById('activeAccountLabel').textContent = App.activeAccount?.name || 'Todas';
      App.reload();
    });

    // Sidebar hamburger + overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebarOverlay';
    document.body.appendChild(overlay);

    const closeSidebar = () => {
      document.getElementById('sidebar').classList.remove('open');
      overlay.classList.remove('show');
    };
    document.getElementById('hamburger').addEventListener('click', () => {
      const isOpen = document.getElementById('sidebar').classList.toggle('open');
      overlay.classList.toggle('show', isOpen);
    });
    overlay.addEventListener('click', closeSidebar);

    // Bottom nav móvil
    document.querySelectorAll('.bn-item[data-section]').forEach(item => {
      item.addEventListener('click', () => {
        App.navigate(item.dataset.section);
        closeSidebar();
      });
    });
    document.getElementById('btnNuevaOpMobile')?.addEventListener('click', () => TradeModal.open());
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      localStorage.removeItem('tv_token');
      localStorage.removeItem('tv_user');
      window.location.href = '/login';
    });

    document.getElementById('btnAddAccount').addEventListener('click', () => App.navigate('cuentas'));
  },

  navigate(section) {
    // Hide all sections
    document.querySelectorAll('.content-area').forEach(el => el.classList.remove('active'));
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Activate section
    const el = document.getElementById(`sec-${section}`);
    if (el) el.classList.add('active');

    // Activate nav item(s)
    document.querySelectorAll(`.nav-item[data-section="${section}"]`).forEach(el => el.classList.add('active'));

    // Update breadcrumb
    const labels = {
      resumen: 'Resumen', calendario: 'Calendario', operaciones: 'Operaciones',
      estrategias: 'Estrategias', analisis: 'Análisis', cuentas: 'Cuentas',
      portfolio: 'Portfolio', funding: 'Movimientos', 'cal-eco': 'Cal. Económico',
      progress: 'Progress Tracker', herramientas: 'Herramientas',
      riesgo: 'Gestión de Riesgo', ajustes: 'Ajustes', diario: 'Diario de Trading',
    };
    document.getElementById('breadcrumb').textContent = labels[section] || section;

    App.activeSection = section;
    App._loadSection(section);

    // Sincronizar bottom nav
    document.querySelectorAll('.bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });
  },

  _loadSection(section) {
    const aid = App.activeAccountId;
    switch (section) {
      case 'resumen':      Dashboard.load(aid); break;
      case 'calendario':   Calendar.load(aid); break;
      case 'operaciones':  Trades.load(aid); break;
      case 'estrategias':  Strategies.load(); break;
      case 'analisis':     Analysis.load(aid); break;
      case 'cuentas':      Accounts.load(); break;
      case 'portfolio':    Portfolio.load(); break;
      case 'funding':      Funding.load(); break;
      case 'cal-eco':      App._loadEcoCalendar(); break;
      case 'progress':     Progress.load(aid); break;
      case 'herramientas': Tools.load(); break;
      case 'riesgo':       Risk.load(aid); break;
      case 'diario':       Journal.load(); break;
      case 'ajustes':      Settings.load(); break;
    }
  },

  reload() { App._loadSection(App.activeSection); },

  async checkPlanStatus() {
    try {
      const me = await API.get('/api/auth/me');
      if (me.trial_expired) {
        App._showPaywall();
      } else if (me.plan === 'trial' && me.days_left !== null && me.days_left <= 7) {
        App._showTrialBanner(me.days_left);
      }
    } catch(e) {}
  },

  _showTrialBanner(daysLeft) {
    const existing = document.getElementById('trialBanner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'trialBanner';
    banner.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#152C4A,#2B72C8);color:#fff;padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;z-index:500;display:flex;align-items:center;gap:14px;box-shadow:0 8px 32px rgba(0,0,0,0.3);white-space:nowrap;';
    banner.innerHTML = `
      <span>⏳ Tu prueba gratuita termina en <strong>${daysLeft === 0 ? 'hoy' : daysLeft + ' días'}</strong></span>
      <a href="#" onclick="App._showPaywall();return false;" style="background:rgba(255,255,255,0.2);color:#fff;padding:5px 14px;border-radius:7px;text-decoration:none;font-size:12px;font-weight:700;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">Activar plan →</a>
      <button onclick="document.getElementById('trialBanner').remove()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:18px;padding:0;line-height:1;">×</button>
    `;
    document.body.appendChild(banner);
  },

  _showPaywall() {
    const existing = document.getElementById('paywallOverlay');
    if (existing) return;
    const overlay = document.createElement('div');
    overlay.id = 'paywallOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,0.95);backdrop-filter:blur(8px);z-index:2000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#172030;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:48px 40px;max-width:460px;width:90%;text-align:center;">
        <div style="font-size:42px;margin-bottom:16px;">🔒</div>
        <h2 style="font-size:24px;font-weight:800;color:#EFF6FF;margin-bottom:10px;letter-spacing:-0.03em;">Tu prueba ha terminado</h2>
        <p style="font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7;margin-bottom:28px;">Activa tu plan para seguir usando FundLog sin límites. Acceso completo por solo <strong style="color:#85B7EB;">€13,99/mes</strong>.</p>
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px 20px;margin-bottom:28px;text-align:left;">
          <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Incluye todo</div>
          ${['Operaciones ilimitadas','Análisis avanzado completo','Calendario económico','Diario de trading','Alertas de riesgo','Importar CSV de MetaTrader'].map(f => `<div style="font-size:13px;color:#EFF6FF;padding:4px 0;display:flex;align-items:center;gap:8px;"><span style="color:#1D9E75;">✓</span> ${f}</div>`).join('')}
        </div>
        <button onclick="App._goToCheckout(this)" style="display:block;width:100%;background:linear-gradient(135deg,#1A3A6A,#2B72C8);color:#fff;padding:14px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;border:none;font-family:inherit;margin-bottom:12px;box-shadow:0 4px 16px rgba(55,138,221,0.4);">→ Activar plan Pro — €13,99/mes</button>
        <button onclick="document.getElementById('paywallOverlay').remove()" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:12px;cursor:pointer;font-family:inherit;">Cerrar y continuar (acceso limitado)</button>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  async _goToCheckout(btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '⏳ Redirigiendo a pago...';
    btn.disabled  = true;
    try {
      const res = await API.post('/api/stripe/checkout', {});
      window.location.href = res.url;
    } catch(e) {
      UI.toast(e.message, 'error');
      btn.innerHTML = orig;
      btn.disabled  = false;
    }
  },

  async checkRiskAlerts() {
    try {
      const aid = App.activeAccountId;
      const [settings, stats] = await Promise.all([
        API.risk.get(aid ? { account_id: aid } : {}),
        API.analysis.stats(aid ? { account_id: aid } : {}),
      ]);

      const totalDD  = stats.max_drawdown || 0;
      const ddLimit  = settings.max_total_drawdown || 5;
      const ddPct    = ddLimit > 0 ? (totalDD / ddLimit) * 100 : 0;

      // P&L de hoy
      const today    = new Date().toISOString().split('T')[0];
      const todayStats = await API.analysis.stats(
        aid ? { account_id: aid, from: today, to: today }
            : { from: today, to: today }
      );
      const todayLoss  = Math.abs(Math.min(0, todayStats.total_pnl || 0));
      const balance    = App.activeAccount?.balance || App._accounts.reduce((s,a) => s+a.balance, 0) || 10000;
      const dailyLimit = settings.max_daily_loss || (balance * settings.max_daily_drawdown / 100);
      const dailyPct   = dailyLimit > 0 ? (todayLoss / dailyLimit) * 100 : 0;

      const banner  = document.getElementById('riskAlertBanner');
      const textEl  = document.getElementById('riskAlertText');
      const badge   = document.getElementById('riskNavBadge');

      let msg   = '';
      let level = '';

      if (ddPct >= 100) {
        msg = `🚨 Drawdown total superado (${totalDD.toFixed(1)}% / ${ddLimit}% límite) — PARA de operar`;
        level = 'danger';
      } else if (ddPct >= 80) {
        msg = `⚠️ Drawdown al ${ddPct.toFixed(0)}% del límite (${totalDD.toFixed(1)}% / ${ddLimit}%)`;
        level = 'warning';
      } else if (dailyPct >= 100) {
        msg = `🚨 Pérdida diaria superada — PARA de operar hoy`;
        level = 'danger';
      } else if (dailyPct >= 80) {
        msg = `⚠️ Pérdida diaria al ${dailyPct.toFixed(0)}% del límite`;
        level = 'warning';
      }

      if (msg) {
        banner.className  = `risk-alert-banner ${level}`;
        textEl.textContent = msg;
        banner.style.display = 'flex';
        badge.style.display  = 'flex';
        // Notificación del navegador si tiene permiso
        if (level === 'danger' && Notification.permission === 'granted') {
          new Notification('FundLog — Alerta de Riesgo', { body: msg, icon: '/favicon.svg' });
        }
      } else {
        banner.style.display = 'none';
        badge.style.display  = 'none';
      }
    } catch(e) { /* silencioso */ }
  },

  // ── Trade Modal ─────────────────────────────────────────────────────────────
  _setupTradeModal() {
    document.getElementById('btnNuevaOp').addEventListener('click', () => TradeModal.open());
    document.getElementById('closeTradeModal').addEventListener('click', () => TradeModal.close());
    document.getElementById('cancelTradeModal').addEventListener('click', () => TradeModal.close());
    document.getElementById('btnSaveTrade').addEventListener('click', () => TradeModal.save());
    document.getElementById('tradeModal').addEventListener('click', e => {
      if (e.target.id === 'tradeModal') TradeModal.close();
    });

    // Populate strategy selector
    API.strategies.list().then(strategies => {
      document.getElementById('trade-strategy').innerHTML = '<option value="">— Sin estrategia —</option>' +
        strategies.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    });

    // Set today's date as default
    document.getElementById('trade-date').value = new Date().toISOString().split('T')[0];

    // Screenshot upload
    document.getElementById('trade-screenshot').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const area = document.getElementById('screenshotArea');
      area.innerHTML = '<div class="screenshot-uploading"><i class="ti ti-loader"></i> Subiendo a Cloudinary...</div>';
      try {
        const url = await Cloudinary.upload(file);
        document.getElementById('trade-screenshot-url').value = url;
        area.innerHTML = `
          <div id="screenshotPreview">
            <img id="screenshotImg" src="${url}" style="width:100%;max-height:160px;object-fit:contain;border-radius:8px;">
            <button type="button" class="screenshot-remove" onclick="TradeModal.removeScreenshot()"><i class="ti ti-x"></i> Quitar</button>
          </div>`;
        UI.toast('Screenshot subido ✓', 'success');
      } catch(err) {
        area.innerHTML = `<div id="screenshotEmpty" onclick="document.getElementById('trade-screenshot').click()">
          <i class="ti ti-photo-plus" style="font-size:28px;color:var(--text-secondary);display:block;margin-bottom:6px;"></i>
          <div style="font-size:13px;color:var(--red-mid);">Error: ${err.message}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:3px;">Toca para reintentar</div>
        </div>`;
        area.querySelector('input') || area.insertAdjacentHTML('beforeend', '<input type="file" id="trade-screenshot" accept="image/*" style="display:none;">');
      }
    });
  },

  // ── Filters ─────────────────────────────────────────────────────────────────
  _setupFilters() {
    ['opsFilterResult', 'opsFilterPair', 'opsFilterMonth'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => Trades.load(App.activeAccountId));
    });
    document.getElementById('opsClearFilters')?.addEventListener('click', () => {
      document.getElementById('opsFilterResult').value = '';
      document.getElementById('opsFilterPair').value   = '';
      document.getElementById('opsFilterMonth').value  = '';
      Trades.load(App.activeAccountId);
    });
  },

  // ── Misc buttons ────────────────────────────────────────────────────────────
  _setupMisc() {
    document.getElementById('btnSaveStrat')?.addEventListener('click', () => Strategies.save());
    document.getElementById('btnShareResults')?.addEventListener('click', () => ShareCard.open());
    document.getElementById('btnSaveEditStrat')?.addEventListener('click', () => Strategies.saveEdit());
    document.getElementById('btnSaveAccount')?.addEventListener('click', () => Accounts.save());
    document.getElementById('btnImportCSV')?.addEventListener('click', () => Import.open());
    document.getElementById('btnSaveEditAccount')?.addEventListener('click', () => Accounts.saveEdit());
    document.getElementById('btnSaveFunding')?.addEventListener('click', () => Funding.save());
    document.getElementById('btnSaveGoal')?.addEventListener('click', () => Progress.save());
    document.getElementById('btnSaveRisk')?.addEventListener('click', () => Risk.save(App.activeAccountId));
    document.getElementById('btnManageBilling')?.addEventListener('click', async () => {
      try {
        const res = await API.post('/api/stripe/portal', {});
        window.location.href = res.url;
      } catch(e) { UI.toast(e.message, 'error'); }
    });
    document.getElementById('btnSaveProfile')?.addEventListener('click', () => Settings.saveProfile());
    document.getElementById('btnSavePwd')?.addEventListener('click', () => Settings.savePassword());
    document.getElementById('btnExportData')?.addEventListener('click', () => Settings.exportData());
    document.getElementById('btnDeleteAccount')?.addEventListener('click', () => Settings.deleteAccount());
    document.getElementById('btnThemeToggle')?.addEventListener('click', () => Theme.toggle());
    document.getElementById('btnThemeToggleBig')?.addEventListener('click', () => Theme.toggle());
    document.getElementById('calPrev')?.addEventListener('click', () => Calendar.prev());
    document.getElementById('calNext')?.addEventListener('click', () => Calendar.next());
    document.getElementById('ecoFilterImpact')?.addEventListener('change', () => App._loadEcoCalendar());
    document.getElementById('ecoFilterCurrency')?.addEventListener('change', () => App._loadEcoCalendar());
    document.getElementById('btnAddEcoEvent')?.addEventListener('click', () => App._openEcoForm());
    document.getElementById('btnSyncEco')?.addEventListener('click', () => App._syncEcoCalendar());
    document.getElementById('btnSaveApiKey')?.addEventListener('click', () => App._saveEcoApiKey());

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => {
          UI.closeModal(m.id);
        });
      }
    });
  },

  // ── Economic Calendar ────────────────────────────────────────────────────────
  async _loadEcoCalendar() {
    // Cargar estado de configuración
    App._loadEcoSettings();

    const impact   = document.getElementById('ecoFilterImpact')?.value   || 'high';
    const currency = document.getElementById('ecoFilterCurrency')?.value || '';
    // Fecha de hoy en hora local (no UTC)
    const now   = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const params = { from: today };
    if (impact)   params.impact   = impact;
    if (currency) params.currency = currency;
    const events = await API.ecoCalendar.list(params);

    const grouped = {};
    events.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    const impactCfg = {
      high:   { label: 'Alto',  cls: 'high',   icon: 'ti-alert-triangle' },
      medium: { label: 'Medio', cls: 'medium',  icon: 'ti-minus' },
      low:    { label: 'Bajo',  cls: 'low',     icon: 'ti-arrow-down' },
    };

    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

    let html = '';

    if (!Object.keys(grouped).length) {
      html = `<div class="empty-state" style="padding:50px 20px;">
        <i class="ti ti-calendar-off" style="font-size:36px;color:#DDE3EF;display:block;margin-bottom:12px;"></i>
        <div style="font-weight:600;margin-bottom:6px;color:var(--text-primary);">Sin eventos para mostrar</div>
        <div style="font-size:12px;">Sincroniza con Finnhub o añade uno manualmente</div>
      </div>`;
    } else {
      for (const [date, evts] of Object.entries(grouped)) {
        const d     = new Date(date + 'T12:00:00');
        const dayN  = dayNames[d.getDay()];
        const dayNum= d.getDate();
        const monthN= monthNames[d.getMonth()];
        const year  = d.getFullYear();
        const today = new Date().toISOString().split('T')[0];
        const isToday   = date === today;
        const highCount = evts.filter(e => e.impact === 'high').length;

        html += `
          <div class="eco-day-block${isToday ? ' eco-day-today' : ''}">
            <div class="eco-day-head">
              <div class="eco-day-num-wrap">
                <div class="eco-day-num${isToday ? ' eco-day-num--today' : ''}">${dayNum}</div>
                <div class="eco-day-name">${dayN}</div>
              </div>
              <div style="flex:1;">
                <div class="eco-day-title">${monthN} ${year}${isToday ? ' <span class="eco-today-badge">Hoy</span>' : ''}</div>
                <div class="eco-day-meta">${evts.length} evento${evts.length !== 1 ? 's' : ''}${highCount ? ` · <span style="color:var(--red-mid);font-weight:600;">${highCount} alto impacto</span>` : ''}</div>
              </div>
            </div>
            <div class="eco-events-list">
              ${evts.map(ev => {
                const cfg = impactCfg[ev.impact] || impactCfg.low;
                const actualColor = ev.actual
                  ? (parseFloat(ev.actual) > parseFloat(ev.forecast || ev.previous || 0) ? 'var(--green-mid)' : 'var(--red-mid)')
                  : 'var(--text-secondary)';
                return `
                  <div class="eco-event eco-event--${cfg.cls}">
                    <div class="eco-event-time">${ev.time || '—'}</div>
                    <div class="eco-event-main">
                      <div class="eco-event-top-row">
                        <span class="eco-flag">${ev.country?.split(' ')[0] || '🌍'}</span>
                        <span class="eco-currency">${ev.currency || ''}</span>
                        <span class="eco-event-name">${ev.event}</span>
                      </div>
                      <div class="eco-event-vals">
                        <div class="eco-val-item">
                          <div class="eco-val-label">Anterior</div>
                          <div class="eco-val-num">${ev.previous || '—'}</div>
                        </div>
                        <div class="eco-val-sep"></div>
                        <div class="eco-val-item">
                          <div class="eco-val-label">Previsto</div>
                          <div class="eco-val-num">${ev.forecast || '—'}</div>
                        </div>
                        <div class="eco-val-sep"></div>
                        <div class="eco-val-item">
                          <div class="eco-val-label">Real</div>
                          <div class="eco-val-num eco-val-real" style="color:${ev.actual ? actualColor : 'var(--text-secondary)'};">${ev.actual || 'Pendiente'}</div>
                        </div>
                      </div>
                    </div>
                    <div class="eco-impact-badge eco-impact-badge--${cfg.cls}">
                      <i class="ti ${cfg.icon}"></i> ${cfg.label}
                    </div>
                    <button class="eco-delete-btn" onclick="App._deleteEcoEvent(${ev.id})" title="Eliminar">
                      <i class="ti ti-x"></i>
                    </button>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }
    }
    document.getElementById('ecoCalendar').innerHTML = html;
  },

  async _loadEcoSettings() {
    try {
      const s = await API.get('/api/economic-calendar/settings');
      const statusEl = document.getElementById('ecoSyncStatus');
      const lastSyncEl = document.getElementById('ecoLastSync');

      if (s.configured) {
        statusEl.innerHTML = `<span class="eco-sync-ok"><i class="ti ti-check"></i> Conectado · Key: ${s.masked}</span>`;
        if (s.lastSync) {
          const d = new Date(s.lastSync);
          lastSyncEl.textContent = `Última sincronización: ${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'})}`;
        }
      } else {
        statusEl.innerHTML = `<span style="color:var(--amber);">⚠️ Sin configurar — Regístrate gratis en <strong>finnhub.io</strong> y pega tu API key</span>`;
      }
    } catch (e) { /* silencioso */ }
  },

  async _saveEcoApiKey() {
    const key = document.getElementById('ecoApiKeyInput').value.trim();
    if (!key) { UI.toast('Pega una API key válida', 'error'); return; }
    try {
      await API.post('/api/economic-calendar/settings', { api_key: key });
      UI.toast('API key guardada correctamente', 'success');
      document.getElementById('ecoApiKeyInput').value = '';
      App._loadEcoSettings();
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async _syncEcoCalendar() {
    const btn = document.getElementById('btnSyncEco');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Sincronizando…';
    try {
      const result = await API.post('/api/economic-calendar/sync', {});
      UI.toast(`✅ ${result.inserted} nuevos · ${result.updated} actualizados`, 'success');
      App._loadEcoCalendar();
    } catch (e) {
      UI.toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-refresh"></i> Sincronizar';
    }
  },

  _ecoFormOpen: false,
  _openEcoForm() {
    const date  = prompt('Fecha del evento (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!date) return;
    const event = prompt('Nombre del evento:');
    if (!event) return;
    const time     = prompt('Hora (HH:MM):', '14:30') || '';
    const country  = prompt('País (emoji + código):', '🇺🇸 USD') || '';
    const currency = country.split(' ')[1] || '';
    const impact   = prompt('Impacto (high / medium / low):', 'high') || 'medium';
    const previous = prompt('Valor anterior:', '') || '';
    const forecast = prompt('Previsión:', '') || '';

    API.ecoCalendar.create({ date, time, country, currency, event, impact, previous, forecast })
      .then(() => { UI.toast('Evento añadido', 'success'); App._loadEcoCalendar(); })
      .catch(e => UI.toast(e.message, 'error'));
  },

  async _deleteEcoEvent(id) {
    if (!confirm('¿Eliminar este evento?')) return;
    await API.ecoCalendar.delete(id);
    App._loadEcoCalendar();
  },
};

// ─── Trade Modal ──────────────────────────────────────────────────────────────
const TradeModal = {
  _editId: null,

  removeScreenshot() {
    document.getElementById('trade-screenshot-url').value = '';
    document.getElementById('trade-screenshot').value = '';
    const area = document.getElementById('screenshotArea');
    area.innerHTML = `
      <input type="file" id="trade-screenshot" accept="image/*" style="display:none;">
      <div id="screenshotEmpty" onclick="document.getElementById('trade-screenshot').click()">
        <i class="ti ti-photo-plus" style="font-size:28px;color:var(--text-secondary);display:block;margin-bottom:6px;"></i>
        <div style="font-size:13px;color:var(--text-secondary);font-weight:500;">Subir screenshot del chart</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:3px;">PNG, JPG · Cloudinary</div>
      </div>`;
    // Re-attach listener
    document.getElementById('trade-screenshot').addEventListener('change', App._screenshotHandler);
  },

  open(trade = null) {
    TradeModal._editId = trade?.id || null;
    document.getElementById('tradeModalTitle').textContent = trade ? 'Editar operación' : 'Nueva operación';

    // Fill form
    document.getElementById('trade-id').value       = trade?.id || '';
    document.getElementById('trade-pair').value      = trade?.pair || '';
    document.getElementById('trade-date').value      = trade?.date || new Date().toISOString().split('T')[0];
    document.getElementById('trade-type').value      = trade?.type || 'long';
    document.getElementById('trade-session').value   = trade?.session || '';
    document.getElementById('trade-entry').value     = trade?.entry_price || '';
    document.getElementById('trade-exit').value      = trade?.exit_price || '';
    document.getElementById('trade-size').value      = trade?.size || '';
    document.getElementById('trade-pnl').value       = trade?.pnl || '';
    document.getElementById('trade-notes').value     = trade?.notes || '';
    document.getElementById('trade-account').value   = trade?.account_id || App.activeAccountId || '';
    document.getElementById('trade-strategy').value  = trade?.strategy_id || '';

    UI.openModal('tradeModal');
    document.getElementById('trade-pair').focus();
  },

  close() {
    UI.closeModal('tradeModal');
    TradeModal._editId = null;
  },

  async save() {
    const data = {
      pair:           document.getElementById('trade-pair').value.trim().toUpperCase(),
      date:           document.getElementById('trade-date').value,
      type:           document.getElementById('trade-type').value,
      session:        document.getElementById('trade-session').value,
      entry_price:    document.getElementById('trade-entry').value,
      exit_price:     document.getElementById('trade-exit').value,
      size:           document.getElementById('trade-size').value,
      pnl:            document.getElementById('trade-pnl').value,
      notes:          document.getElementById('trade-notes').value.trim(),
      account_id:     document.getElementById('trade-account').value || null,
      strategy_id:    document.getElementById('trade-strategy').value || null,
      screenshot_url: document.getElementById('trade-screenshot-url')?.value || '',
    };

    if (!data.pair || !data.date || !data.pnl) {
      UI.toast('Par, fecha y P&L son obligatorios', 'error');
      return;
    }

    const btn = document.getElementById('btnSaveTrade');
    btn.disabled = true;

    try {
      if (TradeModal._editId) {
        await API.trades.update(TradeModal._editId, data);
        UI.toast('Operación actualizada', 'success');
      } else {
        await API.trades.create(data);
        UI.toast('Operación registrada ✓', 'success');
      }
      TradeModal.close();
      await App.loadAccounts(); // update balance
      App.reload();
    } catch (e) {
      UI.toast(e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  },
};

// ─── Cloudinary Upload ────────────────────────────────────────────────────────
const Cloudinary = {
  CLOUD: '', // Se lee de Render env via /api/config
  PRESET: '',

  async upload(file) {
    if (!Cloudinary.CLOUD || !Cloudinary.PRESET) {
      await Cloudinary._loadConfig();
    }
    if (!Cloudinary.CLOUD) throw new Error('Cloudinary no configurado');

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', Cloudinary.PRESET);
    form.append('folder', 'fundlog-trades');

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${Cloudinary.CLOUD}/image/upload`, {
      method: 'POST', body: form
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
  },

  async _loadConfig() {
    try {
      const cfg = await API.get('/api/config/cloudinary');
      Cloudinary.CLOUD  = cfg.cloud_name  || '';
      Cloudinary.PRESET = cfg.upload_preset || '';
    } catch(e) {}
  },
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  const token = localStorage.getItem('tv_token');
  if (!token) { window.location.href = '/login'; return; }

  // Mostrar nombre del usuario en sidebar
  const user = JSON.parse(localStorage.getItem('tv_user') || '{}');
  const nameEl = document.getElementById('sb-user-name');
  const emailEl = document.getElementById('sb-user-email');
  const avatarEl = document.getElementById('sb-avatar-letter');
  if (nameEl)   nameEl.textContent  = user.name  || 'Usuario';
  if (emailEl)  emailEl.textContent = user.email || '';
  if (avatarEl) avatarEl.textContent = (user.name || 'U')[0].toUpperCase();

  App.init();
});
