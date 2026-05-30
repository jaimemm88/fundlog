// ─── UI Utilities ─────────────────────────────────────────────────────────────

const UI = {
  // ── Toast ──────────────────────────────────────────────────────────────────
  toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    const icon = type === 'success' ? 'ti-check' : type === 'error' ? 'ti-x' : 'ti-info-circle';
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="ti ${icon}"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 3000);
  },

  // ── Format helpers ─────────────────────────────────────────────────────────
  fmtCurrency(val, currency = '$', decimals = 0) {
    const n = parseFloat(val) || 0;
    const s = Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (n < 0 ? '−' : '') + currency + s;
  },
  fmtPct(val, decimals = 1) {
    const n = parseFloat(val) || 0;
    return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%';
  },
  fmtDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  },
  fmtNum(val, decimals = 2) {
    return (parseFloat(val) || 0).toFixed(decimals);
  },
  pnlClass(val) {
    const n = parseFloat(val);
    if (n > 0) return 'pnl-pos';
    if (n < 0) return 'pnl-neg';
    return 'pnl-zero';
  },
  pnlStr(val, currency = '$') {
    const n = parseFloat(val) || 0;
    const s = Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n >= 0 ? '+' : '−') + currency + s;
  },
  pill(text, cls) {
    return `<span class="pill ${cls}">${text}</span>`;
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  closeModal(id) {
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
  },

  // ── Stat row ───────────────────────────────────────────────────────────────
  statRow(label, value, cls = '') {
    return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-val ${cls}">${value}</span></div>`;
  },

  // ── Metric card ───────────────────────────────────────────────────────────
  metricCard(label, val, delta = '', deltaClass = '') {
    return `
      <div class="metric">
        <div class="metric-label">${label}</div>
        <div class="metric-val mono">${val}</div>
        ${delta ? `<div class="metric-delta ${deltaClass} mono">${delta}</div>` : ''}
      </div>`;
  },

  // ── Progress bar ──────────────────────────────────────────────────────────
  progressBar(current, target, colorClass = '') {
    const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const cls = pct >= 90 ? 'green' : pct >= 60 ? '' : pct >= 40 ? 'amber' : 'red';
    return `<div class="progress-wrap"><div class="progress-fill ${colorClass || cls}" style="width:${pct.toFixed(1)}%"></div></div>`;
  },

  // ── Chart defaults ────────────────────────────────────────────────────────
  chartDefaults: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#6B7A99' } },
      y: { grid: { color: '#EEF1F8' }, ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#6B7A99' } },
    }
  },

  // ── Destroy & create chart ────────────────────────────────────────────────
  _charts: {},
  chart(id, config) {
    if (UI._charts[id]) { UI._charts[id].destroy(); }
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    UI._charts[id] = new Chart(ctx, config);
    return UI._charts[id];
  },

  // ── Session label ─────────────────────────────────────────────────────────
  sessionLabel(s) {
    const map = { london: '🇬🇧 Londres', ny: '🇺🇸 NY', overlap: '🔀 Overlap', tokyo: '🇯🇵 Tokio', '': '—' };
    return map[s] || s;
  },

  // ── Weekday label ─────────────────────────────────────────────────────────
  weekdayLabel(dow) {
    return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][parseInt(dow)] || dow;
  },

  // ── Animated number counter ───────────────────────────────────────────────
  countUp(el, target, duration = 900, prefix = '', suffix = '') {
    if (!el) return;
    const start     = 0;
    const startTime = performance.now();
    const isFloat   = !Number.isInteger(target);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      el.textContent = prefix + (isFloat ? current.toFixed(2) : Math.round(current).toLocaleString('es-ES')) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  // ── Button ripple ─────────────────────────────────────────────────────────
  addRipple(btn) {
    btn.addEventListener('click', function(e) {
      const rect   = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top  = (e.clientY - rect.top)  + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  },

  // ── Init global interactions ───────────────────────────────────────────────
  initInteractions() {
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => UI.addRipple(btn));
  },
};
