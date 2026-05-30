// ─── Calendario de Operaciones ────────────────────────────────────────────────
const Calendar = {
  _year: new Date().getFullYear(),
  _month: new Date().getMonth(),
  _dailyData: {},
  _selected: null,
  _accountId: null,

  async load(accountId) {
    Calendar._accountId = accountId;
    await Calendar._fetchMonth();
    Calendar._render();
    Calendar._renderMonthlyStats();
  },

  async _fetchMonth() {
    const y = Calendar._year;
    const m = String(Calendar._month + 1).padStart(2, '0');
    const from = `${y}-${m}-01`;
    const to   = `${y}-${m}-31`;
    const daily = await API.trades.daily({ account_id: Calendar._accountId || '', from, to });
    Calendar._dailyData = Object.fromEntries(daily.map(d => [d.date, d]));
  },

  _render() {
    const y = Calendar._year;
    const m = Calendar._month;
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('calTitle').textContent = `${months[m]} ${y}`;
    document.getElementById('cal-sub').textContent  = `${months[m]} ${y}`;

    const firstDay      = new Date(y, m, 1).getDay();
    const offset        = (firstDay === 0 ? 6 : firstDay - 1);
    const daysInMonth   = new Date(y, m + 1, 0).getDate();
    const daysInPrevMon = new Date(y, m, 0).getDate();
    const today         = new Date();

    // Calcular rango P&L para intensidad de color
    const pnlValues = Object.values(Calendar._dailyData).map(d => Math.abs(d.pnl));
    const maxPnl    = Math.max(...pnlValues, 1);

    let html = '';

    // Días del mes anterior
    for (let i = offset - 1; i >= 0; i--) {
      html += `<div class="cal-cell cal-cell--other">${daysInPrevMon - i}</div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr   = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const info      = Calendar._dailyData[dateStr];
      const isToday   = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
      const isSel     = Calendar._selected === dateStr;
      const isWin     = info && info.pnl > 0;
      const isLoss    = info && info.pnl < 0;
      const intensity = info ? Math.min(1, Math.abs(info.pnl) / maxPnl) : 0;

      let cls = 'cal-cell';
      if (isToday) cls += ' cal-cell--today';
      if (isSel)   cls += ' cal-cell--selected';
      if (isWin)   cls += ' cal-cell--win';
      if (isLoss)  cls += ' cal-cell--loss';
      if (!info)   cls += ' cal-cell--empty';

      // Barra de intensidad proporcional al P&L
      const barHtml = info ? `
        <div class="cal-bar-wrap">
          <div class="cal-bar cal-bar--${isWin ? 'win' : 'loss'}"
               style="width:${Math.max(20, intensity * 100).toFixed(0)}%"></div>
        </div>` : '';

      const pnlHtml = info ? `
        <div class="cal-pnl-val cal-pnl-val--${isWin ? 'win' : 'loss'}">
          ${isWin ? '+' : ''}${Math.round(info.pnl)}€
        </div>` : '';

      const tradesHtml = info ? `
        <div class="cal-trades-count">${info.trades} op.</div>` : '';

      html += `
        <div class="${cls}" onclick="Calendar.selectDay('${dateStr}')">
          <div class="cal-cell-num">${d}</div>
          ${pnlHtml}
          ${tradesHtml}
          ${barHtml}
        </div>`;
    }

    // Días del mes siguiente
    const total     = offset + daysInMonth;
    const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-cell cal-cell--other">${i}</div>`;
    }

    document.getElementById('calGrid').innerHTML = html;
  },

  async selectDay(dateStr) {
    Calendar._selected = dateStr;
    Calendar._render();

    const trades    = await API.trades.list({ from: dateStr, to: dateStr });
    const dayTrades = trades.filter(t => t.date === dateStr);
    const container = document.getElementById('cal-day-trades');
    const info      = Calendar._dailyData[dateStr];

    if (!dayTrades.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px;">
          <i class="ti ti-calendar-off" style="font-size:28px;color:#DDE3EF;display:block;margin-bottom:8px;"></i>
          Sin operaciones este día
        </div>`;
      return;
    }

    const dayPnl   = info?.pnl || 0;
    const isPos    = dayPnl >= 0;

    container.innerHTML = `
      <div class="cal-day-header-sel">
        <div>
          <div class="cal-day-sel-date">${UI.fmtDate(dateStr)}</div>
          <div class="cal-day-sel-sub">${dayTrades.length} operación${dayTrades.length !== 1 ? 'es' : ''}</div>
        </div>
        <div class="cal-day-sel-pnl ${isPos ? 'pos' : 'neg'}">${UI.pnlStr(dayPnl)}</div>
      </div>
      <div class="cal-trade-cards">
        ${dayTrades.map(t => {
          const isWin = t.pnl >= 0;
          return `
            <div class="cal-trade-card cal-trade-card--${isWin ? 'win' : 'loss'}">
              <div class="cal-trade-pair">${t.pair}</div>
              <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
                ${UI.pill(t.type === 'long' ? 'Long' : 'Short', t.type)}
                ${t.strategy_name ? `<span style="font-size:10.5px;color:var(--text-secondary);">${t.strategy_name}</span>` : ''}
              </div>
              <div class="cal-trade-prices">
                ${t.entry_price ? `<span class="mono" style="font-size:11px;color:var(--text-secondary);">E: ${t.entry_price}</span>` : ''}
                ${t.exit_price  ? `<span class="mono" style="font-size:11px;color:var(--text-secondary);">S: ${t.exit_price}</span>`  : ''}
              </div>
              <div class="cal-trade-pnl ${isWin ? 'pos' : 'neg'}">${UI.pnlStr(t.pnl)}</div>
            </div>`;
        }).join('')}
      </div>`;
  },

  async _renderMonthlyStats() {
    const y    = Calendar._year;
    const m    = String(Calendar._month + 1).padStart(2, '0');
    const from = `${y}-${m}-01`;
    const to   = `${y}-${m}-31`;

    const [summary, daily] = await Promise.all([
      API.analysis.stats({ account_id: Calendar._accountId || '', from, to }),
      Promise.resolve(Object.values(Calendar._dailyData))
    ]);

    const posDay  = daily.filter(d => d.pnl >= 0).length;
    const negDay  = daily.filter(d => d.pnl <  0).length;
    const bestDay = daily.reduce((a, b) => b.pnl > a ? b.pnl : a, 0);
    const worstDay= daily.reduce((a, b) => b.pnl < a ? b.pnl : a, 0);
    const winRate = summary.total > 0 ? (summary.wins / summary.total * 100).toFixed(1) : 0;

    document.getElementById('cal-monthly-stats').innerHTML = `
      <div class="cal-stat-grid">
        <div class="cal-stat-card cal-stat-card--main">
          <div class="cal-stat-label">P&L del mes</div>
          <div class="cal-stat-big ${summary.total_pnl >= 0 ? 'pos' : 'neg'}">${UI.pnlStr(summary.total_pnl)}</div>
        </div>
        <div class="cal-stat-card">
          <div class="cal-stat-label">Win rate</div>
          <div class="cal-stat-val ${parseFloat(winRate) >= 50 ? 'pos' : 'neg'}">${winRate}%</div>
        </div>
        <div class="cal-stat-card">
          <div class="cal-stat-label">Operaciones</div>
          <div class="cal-stat-val">${summary.total || 0}</div>
        </div>
        <div class="cal-stat-card">
          <div class="cal-stat-label">Días activos</div>
          <div class="cal-stat-val">${daily.length}</div>
        </div>
      </div>
      <div style="margin-top:14px;">
        ${UI.statRow('Días positivos',  posDay,                    'pos')}
        ${UI.statRow('Días negativos',  negDay,                    'neg')}
        ${UI.statRow('Mejor día',       UI.pnlStr(bestDay),        'pos')}
        ${UI.statRow('Peor día',        UI.pnlStr(worstDay),       'neg')}
        ${UI.statRow('Profit Factor',   summary.profit_factor?.toFixed(2) || '—')}
      </div>`;
  },

  prev() {
    Calendar._month--;
    if (Calendar._month < 0) { Calendar._month = 11; Calendar._year--; }
    Calendar._selected = null;
    Calendar._fetchMonth().then(() => { Calendar._render(); Calendar._renderMonthlyStats(); });
  },

  next() {
    Calendar._month++;
    if (Calendar._month > 11) { Calendar._month = 0; Calendar._year++; }
    Calendar._selected = null;
    Calendar._fetchMonth().then(() => { Calendar._render(); Calendar._renderMonthlyStats(); });
  },
};
