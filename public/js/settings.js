// ─── Ajustes ──────────────────────────────────────────────────────────────────
const Settings = {

  load() {
    // Rellenar perfil con datos actuales
    const user = JSON.parse(localStorage.getItem('tv_user') || '{}');
    const nameEl  = document.getElementById('set-name');
    const emailEl = document.getElementById('set-email');
    if (nameEl)  nameEl.value  = user.name  || '';
    if (emailEl) emailEl.value = user.email || '';

    // Sincronizar estado del toggle grande con el estado actual
    Theme.syncToggle();
  },

  // ── Guardar perfil ──────────────────────────────────────────────────────────
  async saveProfile() {
    const name  = document.getElementById('set-name').value.trim();
    const email = document.getElementById('set-email').value.trim();
    if (!name || !email) { UI.toast('Nombre y email son obligatorios', 'error'); return; }

    try {
      const res = await API._fetch('PUT', '/api/auth/profile', { name, email });
      // Actualizar localStorage con nuevos datos
      localStorage.setItem('tv_user',  JSON.stringify(res.user));
      localStorage.setItem('tv_token', res.token);
      // Actualizar sidebar
      const nameEl   = document.getElementById('sb-user-name');
      const avatarEl = document.getElementById('sb-avatar-letter');
      if (nameEl)   nameEl.textContent   = res.user.name;
      if (avatarEl) avatarEl.textContent = res.user.name[0].toUpperCase();
      UI.toast('Perfil actualizado correctamente', 'success');
    } catch(e) { UI.toast(e.message, 'error'); }
  },

  // ── Cambiar contraseña ──────────────────────────────────────────────────────
  async savePassword() {
    const current = document.getElementById('set-pwd-current').value;
    const next    = document.getElementById('set-pwd-new').value;
    const confirm = document.getElementById('set-pwd-confirm').value;

    if (!current || !next || !confirm) { UI.toast('Completa todos los campos', 'error'); return; }
    if (next !== confirm) { UI.toast('Las contraseñas nuevas no coinciden', 'error'); return; }
    if (next.length < 6)  { UI.toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }

    try {
      await API._fetch('PUT', '/api/auth/password', { current_password: current, new_password: next });
      UI.toast('Contraseña cambiada correctamente', 'success');
      ['set-pwd-current','set-pwd-new','set-pwd-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    } catch(e) { UI.toast(e.message, 'error'); }
  },

  // ── Exportar datos ──────────────────────────────────────────────────────────
  async exportData() {
    try {
      const trades = await API.trades.list({});
      const headers = ['Fecha','Par','Tipo','Entrada','Salida','Tamaño','P&L','Resultado','Estrategia','Sesión','Notas'];
      const rows = trades.map(t => [
        t.date, t.pair, t.type, t.entry_price, t.exit_price,
        t.size, t.pnl, t.result, t.strategy_name || '', t.session, t.notes || ''
      ].map(v => `"${v}"`).join(','));

      const csv  = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `fundlog_operaciones_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast(`${trades.length} operaciones exportadas`, 'success');
    } catch(e) { UI.toast(e.message, 'error'); }
  },

  // ── Eliminar cuenta ─────────────────────────────────────────────────────────
  deleteAccount() {
    const confirmed = prompt('Esta acción eliminará TODOS tus datos permanentemente.\nEscribe "ELIMINAR" para confirmar:');
    if (confirmed !== 'ELIMINAR') { UI.toast('Operación cancelada', 'info'); return; }
    UI.toast('Función disponible próximamente en la versión cloud', 'info');
  },
};

// ─── Tema claro / oscuro ──────────────────────────────────────────────────────
const Theme = {
  _dark: false,

  init() {
    const saved = localStorage.getItem('tv_theme');
    if (saved === 'dark') Theme.apply(true, false);
    else Theme.apply(false, false);
  },

  toggle() {
    Theme.apply(!Theme._dark, true);
  },

  apply(dark, save = true) {
    Theme._dark = dark;
    document.body.classList.toggle('dark', dark);

    // Topbar icon
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = dark ? 'ti ti-moon' : 'ti ti-sun';

    // Label del toggle grande
    Theme.syncToggle();

    if (save) localStorage.setItem('tv_theme', dark ? 'dark' : 'light');
  },

  syncToggle() {
    const label = document.getElementById('themeLabelBig');
    const track = document.querySelector('.theme-toggle-track');
    if (label) label.textContent = Theme._dark ? 'Oscuro' : 'Claro';
  },
};
