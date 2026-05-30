// ─── CSV Importer ─────────────────────────────────────────────────────────────
const Import = {
  _step:    1,
  _format:  'mt5',
  _parsed:  [],
  _file:    null,

  init() {
    // Format cards
    document.querySelectorAll('.import-fmt-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.import-fmt-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        Import._format = card.dataset.fmt;
        Import._updateHint();
      });
    });

    // Dropzone
    const dz   = document.getElementById('importDropzone');
    const file  = document.getElementById('importFile');

    dz.addEventListener('click', () => file.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) Import._loadFile(f);
    });
    file.addEventListener('change', e => {
      if (e.target.files[0]) Import._loadFile(e.target.files[0]);
    });

    // Select all checkbox
    document.getElementById('importSelectAll')?.addEventListener('change', e => {
      document.querySelectorAll('.import-row-check').forEach(cb => cb.checked = e.target.checked);
    });

    // Populate account selector
    API.accounts.list().then(accounts => {
      const sel = document.getElementById('import-account');
      sel.innerHTML = '<option value="">— Sin cuenta —</option>' +
        accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
      if (App.activeAccountId) sel.value = App.activeAccountId;
    });
  },

  _updateHint() {
    const hints = {
      mt5:     'En MT5: pestaña <strong>Historia</strong> → clic derecho → <strong>Guardar como reporte detallado</strong> → formato CSV (separado por punto y coma)',
      mt4:     'En MT4: pestaña <strong>Historial de cuenta</strong> → clic derecho → <strong>Guardar como reporte detallado</strong> → guarda como .htm y renombra a .csv',
      generic: 'CSV con columnas: fecha, par, tipo (buy/sell), lotes, entrada, salida, P&L. La primera fila debe ser la cabecera.',
    };
    document.getElementById('importHint').innerHTML =
      `<i class="ti ti-info-circle"></i><span>${hints[Import._format]}</span>`;
  },

  _loadFile(file) {
    Import._file = file;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text    = e.target.result;
        const trades  = Import._parse(text, Import._format);
        Import._parsed = trades;

        const dz = document.getElementById('importDropzone');
        dz.innerHTML = `
          <i class="ti ti-file-check" style="font-size:32px;color:var(--green-mid);margin-bottom:10px;"></i>
          <div style="font-size:14px;font-weight:600;margin-bottom:4px;">${file.name}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${trades.length} operaciones detectadas</div>`;

        if (trades.length === 0) {
          UI.toast('No se detectaron operaciones. Comprueba el formato.', 'error');
        }
      } catch(err) {
        UI.toast('Error al leer el archivo: ' + err.message, 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  },

  // ── Parsers ────────────────────────────────────────────────────────────────
  _parse(text, format) {
    if (format === 'mt5') return Import._parseMT5(text);
    if (format === 'mt4') return Import._parseMT4(text);
    return Import._parseGeneric(text);
  },

  _parseMT5(text) {
    // MT5 usa ; como separador
    const sep   = text.includes(';') ? ';' : ',';
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];

    const header = lines[0].split(sep).map(h => h.replace(/"/g,'').trim().toLowerCase());
    const idxTime   = Import._col(header, ['time','fecha','date']);
    const idxSymbol = Import._col(header, ['symbol','par','instrumento']);
    const idxType   = Import._col(header, ['type','tipo']);
    const idxDir    = Import._col(header, ['direction','dirección','dir','entrada/salida']);
    const idxVol    = Import._col(header, ['volume','volumen','size','lots','lotes']);
    const idxPrice  = Import._col(header, ['price','precio']);
    const idxProfit = Import._col(header, ['profit','beneficio','p&l','ganancia']);
    const idxOrder  = Import._col(header, ['order','orden','deal','operación']);

    // Collect opening trades to get entry price
    const openTrades = {};
    const result     = [];

    for (let i = 1; i < lines.length; i++) {
      const cols  = lines[i].split(sep).map(c => c.replace(/"/g,'').trim());
      const dir   = (cols[idxDir] || '').toLowerCase();
      const type  = (cols[idxType] || '').toLowerCase();
      const order = cols[idxOrder] || '';

      // Skip balance/deposit/correction rows
      if (type === 'balance' || type === 'deposit' || type === 'withdrawal' ||
          type === 'credit'  || type === 'correction') continue;

      if (dir === 'in' || dir === 'entrada') {
        openTrades[order] = { price: parseFloat(cols[idxPrice]) || 0, type };
      }
      if (dir === 'out' || dir === 'salida') {
        const profit     = parseFloat(cols[idxProfit]) || 0;
        const exitPrice  = parseFloat(cols[idxPrice])  || 0;
        const open       = openTrades[order];
        const entryPrice = open?.price || 0;
        const openType   = (open?.type || type || '').toLowerCase();
        const tradeType  = openType.includes('buy') ? 'long' : 'short';

        const rawTime    = cols[idxTime] || '';
        const date       = Import._parseDate(rawTime);
        const symbol     = (cols[idxSymbol] || '').replace(/\./g, '/');

        if (!date || !symbol) continue;

        result.push({
          date, pair: symbol, type: tradeType,
          entry_price: entryPrice,
          exit_price:  exitPrice,
          size:        parseFloat(cols[idxVol]) || 0,
          pnl:         profit,
          result:      profit >= 0 ? 'win' : 'loss',
          session:     Import._guessSession(rawTime),
          notes:       `Importado MT5`,
          external_id: order,
        });
      }
    }

    // Si no hay columna Direction (algunos brokers), buscar por profit != 0
    if (!result.length && idxDir === -1) {
      for (let i = 1; i < lines.length; i++) {
        const cols   = lines[i].split(sep).map(c => c.replace(/"/g,'').trim());
        const profit = parseFloat(cols[idxProfit]);
        if (isNaN(profit) || profit === 0) continue;
        const type   = (cols[idxType] || '').toLowerCase();
        if (type === 'balance' || type === 'deposit') continue;

        const rawTime = cols[idxTime] || '';
        const date    = Import._parseDate(rawTime);
        const symbol  = (cols[idxSymbol] || '').replace(/\./g, '/');
        if (!date || !symbol) continue;

        result.push({
          date, pair: symbol,
          type:        type.includes('buy') ? 'long' : 'short',
          entry_price: 0, exit_price: parseFloat(cols[idxPrice]) || 0,
          size:        parseFloat(cols[idxVol]) || 0,
          pnl: profit, result: profit >= 0 ? 'win' : 'loss',
          session: Import._guessSession(rawTime),
          notes: 'Importado MT5',
          external_id: cols[idxOrder] || String(i),
        });
      }
    }

    return result;
  },

  _parseMT4(text) {
    // MT4 exporta HTML; intentamos parsear como texto plano
    const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    const lines   = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 10);

    const result = [];
    for (const line of lines) {
      // Buscar líneas con "close" que tienen P&L
      if (!/close/i.test(line)) continue;
      const parts = line.split(/\s{2,}|\t/).filter(Boolean);
      if (parts.length < 8) continue;

      // Intentar extraer datos básicos
      const profit = parseFloat(parts[parts.length - 2]?.replace(',','.'));
      if (isNaN(profit)) continue;

      const dateStr = parts.find(p => /\d{4}\.\d{2}\.\d{2}/.test(p)) || '';
      const date    = Import._parseDate(dateStr);
      if (!date) continue;

      const symbol  = parts.find(p => /^[A-Z]{3,6}(\/[A-Z]{3})?$/.test(p)) || 'UNKNOWN';
      result.push({
        date, pair: symbol, type: 'long',
        entry_price: 0, exit_price: 0, size: 0,
        pnl: profit, result: profit >= 0 ? 'win' : 'loss',
        session: '', notes: 'Importado MT4', external_id: String(result.length),
      });
    }
    return result;
  },

  _parseGeneric(text) {
    const sep   = text.includes(';') ? ';' : ',';
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].split(sep).map(h => h.replace(/"/g,'').trim().toLowerCase());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.replace(/"/g,'').trim());
      const row  = Object.fromEntries(header.map((h, j) => [h, cols[j] || '']));

      const profit = parseFloat(
        row.profit || row['p&l'] || row.ganancia || row.beneficio || row.pnl || 0
      );
      const rawDate = row.time || row.fecha || row.date || row.datetime || '';
      const date    = Import._parseDate(rawDate);
      const symbol  = (row.symbol || row.par || row.pair || row.instrumento || '').replace(/\./g, '/');

      if (!date || !symbol || isNaN(profit)) continue;

      const typeRaw = (row.type || row.tipo || row.direction || '').toLowerCase();
      const type    = typeRaw.includes('buy') || typeRaw.includes('long') ? 'long' : 'short';

      result.push({
        date, pair: symbol, type,
        entry_price: parseFloat(row.entry || row.entrada || row['open price'] || 0),
        exit_price:  parseFloat(row.exit  || row.salida  || row['close price'] || row.price || 0),
        size:        parseFloat(row.volume || row.lotes   || row.lots || row.size || 0),
        pnl: profit, result: profit >= 0 ? 'win' : 'loss',
        session: '', notes: 'Importado CSV', external_id: String(i),
      });
    }
    return result;
  },

  // ── Helpers ────────────────────────────────────────────────────────────────
  _col(header, names) {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    // Búsqueda parcial
    for (const n of names) {
      const idx = header.findIndex(h => h.includes(n));
      if (idx !== -1) return idx;
    }
    return -1;
  },

  _parseDate(raw) {
    if (!raw) return null;
    // "2026.05.29 10:30:15" → "2026-05-29"
    const m1 = raw.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
    // "29/05/2026"
    const m2 = raw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
    return null;
  },

  _guessSession(rawTime) {
    const m = rawTime.match(/(\d{2}):\d{2}/);
    if (!m) return '';
    const h = parseInt(m[1]);
    if (h >= 0  && h < 8)  return 'tokyo';
    if (h >= 8  && h < 12) return 'london';
    if (h >= 12 && h < 16) return 'overlap';
    return 'ny';
  },

  // ── Flujo de pasos ─────────────────────────────────────────────────────────
  open() {
    Import._step   = 1;
    Import._parsed = [];
    Import._file   = null;
    Import._showStep(1);
    UI.openModal('importModal');
    Import.init();
  },

  _showStep(n) {
    Import._step = n;
    [1,2,3].forEach(i => {
      document.getElementById(`import-step${i}`).style.display = i === n ? 'block' : 'none';
    });
    document.getElementById('importBtnBack').style.display = n > 1 ? 'inline-flex' : 'none';
    const btn = document.getElementById('importBtnNext');
    if (n === 1) { btn.innerHTML = '<i class="ti ti-arrow-right"></i> Continuar'; btn.style.display = 'inline-flex'; }
    if (n === 2) { btn.innerHTML = '<i class="ti ti-download"></i> Importar operaciones'; btn.style.display = 'inline-flex'; }
    if (n === 3) { btn.style.display = 'none'; }
  },

  next() {
    if (Import._step === 1) return Import._goToPreview();
    if (Import._step === 2) return Import._doImport();
  },

  back() {
    Import._showStep(Import._step - 1);
  },

  _goToPreview() {
    if (!Import._parsed.length) {
      UI.toast('Primero sube un archivo CSV', 'error');
      return;
    }
    const checked = Import._parsed.filter(t => t.pnl !== 0);
    const total   = Import._parsed.length;
    const wins    = checked.filter(t => t.pnl > 0).length;
    const totalPnl = checked.reduce((s, t) => s + t.pnl, 0);

    document.getElementById('importSummary').innerHTML = `
      <div class="import-summary-grid">
        <div class="import-sum-item"><div class="import-sum-val">${total}</div><div class="import-sum-lbl">Operaciones</div></div>
        <div class="import-sum-item"><div class="import-sum-val" style="color:var(--green-mid)">${wins}</div><div class="import-sum-lbl">Ganadoras</div></div>
        <div class="import-sum-item"><div class="import-sum-val" style="color:var(--red-mid)">${total-wins}</div><div class="import-sum-lbl">Perdedoras</div></div>
        <div class="import-sum-item"><div class="import-sum-val ${totalPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${UI.pnlStr(totalPnl)}</div><div class="import-sum-lbl">P&L total</div></div>
      </div>`;

    document.getElementById('importPreviewBody').innerHTML = Import._parsed.map((t, i) => `
      <tr>
        <td><input type="checkbox" class="import-row-check" data-idx="${i}" checked></td>
        <td style="color:var(--text-secondary);font-size:11px;">${t.date}</td>
        <td class="mono">${t.pair}</td>
        <td>${UI.pill(t.type === 'long' ? 'Long' : 'Short', t.type)}</td>
        <td class="mono" style="font-size:11px;">${t.entry_price || '—'}</td>
        <td class="mono" style="font-size:11px;">${t.exit_price  || '—'}</td>
        <td class="mono" style="font-size:11px;">${t.size || '—'}</td>
        <td class="${UI.pnlClass(t.pnl)}">${UI.pnlStr(t.pnl)}</td>
      </tr>`).join('');

    Import._showStep(2);
  },

  async _doImport() {
    const checks  = document.querySelectorAll('.import-row-check:checked');
    const indices = Array.from(checks).map(c => parseInt(c.dataset.idx));
    const trades  = indices.map(i => Import._parsed[i]);
    const accId   = document.getElementById('import-account').value || null;

    const btn = document.getElementById('importBtnNext');
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader"></i> Importando…';

    try {
      const res = await API.post('/api/trades/import', {
        trades,
        account_id: accId,
      });

      document.getElementById('importResult').innerHTML = `
        <div style="text-align:center;padding:20px;">
          <i class="ti ti-circle-check" style="font-size:48px;color:var(--green-mid);display:block;margin-bottom:14px;"></i>
          <div style="font-size:18px;font-weight:700;margin-bottom:6px;">¡Importación completada!</div>
          <div style="font-size:13px;color:var(--text-secondary);">
            <strong>${res.inserted}</strong> operaciones importadas
            ${res.skipped ? ` · <strong>${res.skipped}</strong> omitidas (duplicadas)` : ''}
          </div>
        </div>`;
      Import._showStep(3);
      App.reload();
    } catch(e) {
      UI.toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-download"></i> Importar operaciones';
    }
  },
};
