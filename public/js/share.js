// ─── Share Card ───────────────────────────────────────────────────────────────
const ShareCard = {
  _period: 'month',
  _stats:  null,

  THEMES: {
    dark: {
      bg:      'linear-gradient(145deg,#080E1A 0%,#0F1F3A 60%,#080E1A 100%)',
      accent:  '#378ADD',
      accentBg:'rgba(55,138,221,0.15)',
      text:    '#EFF6FF',
      sub:     'rgba(255,255,255,0.45)',
      border:  'rgba(255,255,255,0.08)',
      posColor:'#4ABFA0',
      negColor:'#E07A5A',
    },
    navy: {
      bg:      'linear-gradient(145deg,#0A1628 0%,#152C4A 60%,#0A1628 100%)',
      accent:  '#85B7EB',
      accentBg:'rgba(133,183,235,0.15)',
      text:    '#EFF6FF',
      sub:     'rgba(255,255,255,0.45)',
      border:  'rgba(255,255,255,0.1)',
      posColor:'#4ABFA0',
      negColor:'#E07A5A',
    },
    green: {
      bg:      'linear-gradient(145deg,#071A12 0%,#0F2D1E 60%,#071A12 100%)',
      accent:  '#4ABFA0',
      accentBg:'rgba(29,158,117,0.15)',
      text:    '#EFF6FF',
      sub:     'rgba(255,255,255,0.45)',
      border:  'rgba(29,158,117,0.15)',
      posColor:'#4ABFA0',
      negColor:'#E07A5A',
    },
  },

  async open() {
    UI.openModal('shareModal');
    ShareCard._setupControls();
    await ShareCard.render();
  },

  _setupControls() {
    document.querySelectorAll('.share-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.share-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ShareCard._period = btn.dataset.period;
        ShareCard.render();
      });
    });
    document.getElementById('shareTheme').addEventListener('change', () => ShareCard.render());
    document.getElementById('shareHideUser').addEventListener('change', () => ShareCard.render());
    document.getElementById('btnDownloadCard').addEventListener('click', () => ShareCard.download());
    document.getElementById('btnCopyCard').addEventListener('click', () => ShareCard.copy());
  },

  async _getParams() {
    const now     = new Date();
    const today   = now.toISOString().split('T')[0];
    const months  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    if (ShareCard._period === 'day') {
      return { from: today, to: today, label: UI.fmtDate(today) };
    }
    if (ShareCard._period === 'month') {
      return {
        from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,
        label: months[now.getMonth()] + ' ' + now.getFullYear(),
      };
    }
    if (ShareCard._period === 'year') {
      return { from: `${now.getFullYear()}-01-01`, label: 'Año ' + now.getFullYear() };
    }
    return { from: '', label: 'Histórico completo' };
  },

  async render() {
    const card    = document.getElementById('shareCard');
    const themeId = document.getElementById('shareTheme').value;
    const t       = ShareCard.THEMES[themeId];
    const params  = await ShareCard._getParams();
    const aid     = App.activeAccountId;
    const query   = { ...(aid ? { account_id: aid } : {}), ...(params.from ? { from: params.from } : {}) };

    try {
      const [stats, streak] = await Promise.all([
        API.analysis.stats(query),
        API.trades.list({ ...query, limit: 30 }),
      ]);
      ShareCard._stats = stats;

      const pnl      = stats.total_pnl || 0;
      const wr       = stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) : 0;
      const pf       = stats.gross_loss > 0 ? (stats.gross_profit / stats.gross_loss).toFixed(2) : '—';
      const avgWin   = stats.avg_win  ? UI.pnlStr(stats.avg_win)  : '—';
      const avgLoss  = stats.avg_loss ? UI.pnlStr(Math.abs(stats.avg_loss)) : '—';
      const pnlColor = pnl >= 0 ? t.posColor : t.negColor;
      const hideUser = document.getElementById('shareHideUser')?.checked || false;
      const user     = JSON.parse(localStorage.getItem('tv_user') || '{}');

      // Calcular racha actual
      let curStreak = 0, streakType = '';
      const recent = streak.filter(tr => tr.result).reverse();
      if (recent.length) {
        streakType = recent[0].result;
        for (const tr of recent) {
          if (tr.result === streakType) curStreak++;
          else break;
        }
      }
      const streakEmoji = streakType === 'win' ? '🔥' : streakType === 'loss' ? '⚠️' : '';
      const streakLabel = curStreak > 1
        ? `${streakEmoji} ${curStreak} ${streakType === 'win' ? 'wins' : 'pérdidas'} seguidas`
        : '';

      card.style.cssText = `
        width:480px;height:480px;position:relative;
        background:${t.bg};
        display:flex;flex-direction:column;justify-content:space-between;
        padding:38px 40px;font-family:'Sora',sans-serif;
      `;

      card.innerHTML = `
        <!-- Orbes decorativos -->
        <div style="position:absolute;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,${t.accentBg} 0%,transparent 70%);top:-80px;right:-60px;pointer-events:none;"></div>
        <div style="position:absolute;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(29,158,117,0.1) 0%,transparent 70%);bottom:-60px;left:-40px;pointer-events:none;"></div>

        <!-- Header -->
        <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:11px;">
            <div style="width:38px;height:38px;background:#1A3A6A;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(55,138,221,0.4);">
              <span style="font-size:20px;font-weight:900;color:white;font-family:Georgia,serif;line-height:1;">f</span>
            </div>
            <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;font-family:Arial,sans-serif;">
              <span style="color:${t.text};">Fund</span><span style="color:${t.accent};">Log</span>
            </div>
          </div>
          <div style="font-size:${ShareCard._period === 'day' ? '13' : '12'}px;color:${t.sub};font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">${params.label}</div>
        </div>

        <!-- P&L principal -->
        <div style="position:relative;z-index:1;text-align:center;margin:8px 0;">
          <div style="font-size:11px;color:${t.sub};text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:10px;">P&L ${{ day:'de hoy', month:'del mes', year:'del año', all:'total' }[ShareCard._period]}</div>
          <div style="font-size:68px;font-weight:800;color:${pnlColor};letter-spacing:-3px;line-height:1;font-family:'JetBrains Mono',monospace;">
            ${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0})}
          </div>
          ${streakLabel ? `<div style="margin-top:10px;font-size:14px;color:${t.sub};font-weight:600;">${streakLabel}</div>` : ''}
        </div>

        <!-- Stats grid -->
        <div style="position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          ${[
            { label: 'Win Rate', val: wr + '%', color: parseFloat(wr) >= 50 ? t.posColor : t.negColor },
            { label: 'Profit Factor', val: pf, color: parseFloat(pf) > 1 ? t.posColor : t.negColor },
            { label: 'Operaciones', val: stats.total || 0, color: t.text },
            { label: 'Media ganancia', val: avgWin, color: t.posColor },
            { label: 'Media pérdida', val: avgLoss, color: t.negColor },
            { label: 'Mejor trade', val: stats.best_trade ? UI.pnlStr(stats.best_trade) : '—', color: t.posColor },
          ].map(s => `
            <div style="background:${t.accentBg};border:1px solid ${t.border};border-radius:10px;padding:12px 10px;text-align:center;">
              <div style="font-size:9px;color:${t.sub};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin-bottom:6px;">${s.label}</div>
              <div style="font-size:17px;font-weight:800;color:${s.color};font-family:'JetBrains Mono',monospace;letter-spacing:-0.5px;">${s.val}</div>
            </div>`).join('')}
        </div>

        <!-- Footer -->
        <div style="position:relative;z-index:1;display:flex;justify-content:${hideUser ? 'flex-end' : 'space-between'};align-items:center;">
          ${hideUser ? '' : `<div style="font-size:11px;color:${t.sub};">@${user.name || 'trader'}</div>`}
          <div style="font-size:12px;font-weight:700;color:${t.accent};letter-spacing:-0.2px;">fundlog.es</div>
        </div>
      `;
    } catch(e) {
      card.innerHTML = `<div style="color:red;padding:20px;">Error: ${e.message}</div>`;
    }
  },

  async _getCanvas() {
    const card = document.getElementById('shareCard');
    const script = document.createElement('script');
    script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
    await new Promise(resolve => {
      if (window.html2canvas) { resolve(); return; }
      script.onload = resolve;
      document.head.appendChild(script);
    });
    return await html2canvas(card, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });
  },

  async download() {
    const btn = document.getElementById('btnDownloadCard');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Generando...';
    try {
      const canvas = await ShareCard._getCanvas();
      const link   = document.createElement('a');
      const now    = new Date();
      link.download = `fundlog-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.png`;
      link.href     = canvas.toDataURL('image/png');
      link.click();
      UI.toast('¡Imagen descargada!', 'success');
    } catch(e) {
      UI.toast('Error al generar la imagen', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-download"></i> Descargar PNG';
    }
  },

  async copy() {
    const btn = document.getElementById('btnCopyCard');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Copiando...';
    try {
      const canvas = await ShareCard._getCanvas();
      canvas.toBlob(async blob => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        UI.toast('¡Imagen copiada al portapapeles!', 'success');
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-copy"></i> Copiar imagen';
      }, 'image/png');
    } catch(e) {
      UI.toast('Haz screenshot directamente 📸', 'info');
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-copy"></i> Copiar imagen';
    }
  },
};
