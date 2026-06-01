// ─── Share Card ───────────────────────────────────────────────────────────────
const ShareCard = {
  _period:  'month',
  _format:  'square',
  _pnlMode: 'amount', // 'amount' | 'pct'
  _stats:   null,

  FORMATS: {
    square:   { w: 480, h: 480,  display_w: 480, display_h: 480,  label: '1:1',  export_w: 1080, export_h: 1080  },
    story:    { w: 270, h: 480,  display_w: 270, display_h: 480,  label: '9:16', export_w: 1080, export_h: 1920 },
    portrait: { w: 384, h: 480,  display_w: 384, display_h: 480,  label: '4:5',  export_w: 1080, export_h: 1350 },
    twitter:  { w: 480, h: 270,  display_w: 480, display_h: 270,  label: '16:9', export_w: 1280, export_h: 720  },
  },

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
    document.querySelectorAll('.share-format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.share-format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ShareCard._format = btn.dataset.format;
        ShareCard.render();
      });
    });
    document.querySelectorAll('.share-pnl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.share-pnl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ShareCard._pnlMode = btn.dataset.pnl;
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

      // Calcular rentabilidad % usando balance de cuentas
      const accounts   = await API.accounts.list().catch(() => []);
      const totalInitial = accounts.reduce((s, a) => s + (a.initial_balance || 0), 0);
      const pct        = totalInitial > 0 ? ((pnl / totalInitial) * 100) : 0;
      const isPct      = ShareCard._pnlMode === 'pct';
      const mainValue  = isPct
        ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
        : `${pnl >= 0 ? '+' : '−'}$${Math.abs(pnl).toLocaleString('es-ES',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
      const mainLabel  = isPct ? 'RENTABILIDAD' : `P&L ${{ day:'DE HOY', month:'DEL MES', year:'DEL AÑO', all:'TOTAL' }[ShareCard._period]}`;
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

      const fmt = ShareCard.FORMATS[ShareCard._format] || ShareCard.FORMATS.square;
      const isStory   = ShareCard._format === 'story';
      const isTwitter = ShareCard._format === 'twitter';
      const padH = isTwitter ? '28px' : '38px';
      const padW = isStory   ? '28px' : '40px';

      card.style.cssText = `
        width:${fmt.display_w}px;height:${fmt.display_h}px;position:relative;
        background:${t.bg};
        display:flex;flex-direction:column;justify-content:space-between;
        padding:${padH} ${padW};font-family:'Sora',sans-serif;
        border-radius:14px;overflow:hidden;
        box-shadow:0 8px 32px rgba(0,0,0,0.25);
        transition:width 0.25s ease,height 0.25s ease;
      `;

      // Config por formato
      const pnlSize   = isStory ? '52px' : isTwitter ? '46px' : '68px';
      const statCols  = isTwitter ? '1fr 1fr 1fr 1fr' : isStory ? '1fr 1fr' : '1fr 1fr 1fr';
      const statPad   = isStory ? '10px 8px' : '12px 10px';
      const statFs    = isStory ? '15px' : isTwitter ? '15px' : '17px';
      const statLblFs = isStory ? '8px'  : '9px';
      const logoH     = isTwitter ? '34px' : isStory ? '40px' : '48px';
      const periodFs  = isTwitter ? '11px' : '12px';
      const pnlLblFs  = isTwitter ? '10px' : '11px';

      const allStats = [
        { label: 'Win Rate',      val: wr + '%',  color: parseFloat(wr) >= 50 ? t.posColor : t.negColor },
        { label: 'Profit Factor', val: pf,        color: parseFloat(pf) > 1 ? t.posColor : t.negColor },
        { label: 'Operaciones',   val: stats.total || 0, color: t.text },
        { label: 'Media gan.',    val: avgWin,    color: t.posColor },
        { label: 'Media pér.',    val: avgLoss,   color: t.negColor },
        { label: 'Mejor trade',   val: stats.best_trade ? UI.pnlStr(stats.best_trade) : '—', color: t.posColor },
      ];
      // Twitter: 4 stats en una fila; Story: 4 stats en 2x2; otros: 6 stats en 2x3
      const statsToShow = isTwitter ? allStats.slice(0,4) : isStory ? allStats.slice(0,4) : allStats;

      card.innerHTML = `
        <!-- Orbes -->
        <div style="position:absolute;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,${t.accentBg} 0%,transparent 70%);top:-60px;right:-50px;pointer-events:none;"></div>
        <div style="position:absolute;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(29,158,117,0.1) 0%,transparent 70%);bottom:-50px;left:-30px;pointer-events:none;"></div>

        <!-- Header -->
        <div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;">
          <img src="/fundlog-logo.png" style="height:${logoH};width:auto;object-fit:contain;" crossorigin="anonymous">
          <div style="font-size:${periodFs};color:${t.sub};font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${params.label}</div>
        </div>

        <!-- P&L -->
        <div style="position:relative;z-index:1;text-align:center;${isTwitter ? 'margin:0;' : 'margin:6px 0;'}">
          <div style="font-size:${pnlLblFs};color:${t.sub};text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:${isTwitter?'4px':'8px'};">${mainLabel}</div>
          <div style="font-size:${pnlSize};font-weight:800;color:${pnlColor};letter-spacing:-2px;line-height:1;font-family:'JetBrains Mono',monospace;">
            ${mainValue}
          </div>
          ${streakLabel && !isTwitter ? `<div style="margin-top:8px;font-size:13px;color:${t.sub};font-weight:600;">${streakLabel}</div>` : ''}
        </div>

        <!-- Stats -->
        <div style="position:relative;z-index:1;display:grid;grid-template-columns:${statCols};gap:8px;">
          ${statsToShow.map(s => `
            <div style="background:${t.accentBg};border:1px solid ${t.border};border-radius:9px;padding:${statPad};text-align:center;">
              <div style="font-size:${statLblFs};color:${t.sub};text-transform:uppercase;letter-spacing:0.07em;font-weight:700;margin-bottom:5px;">${s.label}</div>
              <div style="font-size:${statFs};font-weight:800;color:${s.color};font-family:'JetBrains Mono',monospace;letter-spacing:-0.5px;">${s.val}</div>
            </div>`).join('')}
        </div>

        <!-- Footer -->
        <div style="position:relative;z-index:1;display:flex;justify-content:${hideUser ? 'flex-end' : 'space-between'};align-items:center;">
          ${hideUser ? '' : `<div style="font-size:11px;color:${t.sub};">${user.nickname ? user.nickname : '@' + (user.name || 'trader')}</div>`}
          <div style="font-size:12px;font-weight:700;color:${t.accent};letter-spacing:-0.2px;">fundlog.es</div>
        </div>
      `;
    } catch(e) {
      card.innerHTML = `<div style="color:red;padding:20px;">Error: ${e.message}</div>`;
    }
  },

  async _getCanvas() {
    const card = document.getElementById('shareCard');
    const fmt  = ShareCard.FORMATS[ShareCard._format] || ShareCard.FORMATS.square;
    const script = document.createElement('script');
    script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
    await new Promise(resolve => {
      if (window.html2canvas) { resolve(); return; }
      script.onload = resolve;
      document.head.appendChild(script);
    });
    // Escala para exportar a la resolución completa del formato
    const scale = fmt.export_w / fmt.display_w;
    return await html2canvas(card, {
      scale,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      width:  fmt.display_w,
      height: fmt.display_h,
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
