// ─── Herramientas / Calculadoras ──────────────────────────────────────────────
const Tools = {
  load() {
    Tools.calcPosition();
    Tools.calcPip();
    Tools.calcRR();
    Tools.calcExpectancy();
    Tools.calcDDRecovery();

    // Tool card navigation
    document.querySelectorAll('.tool-card[data-goto]').forEach(card => {
      card.addEventListener('click', () => App.navigate(card.dataset.goto));
    });
  },

  calcPosition() {
    const balance  = parseFloat(document.getElementById('tool-balance').value) || 0;
    const risk     = parseFloat(document.getElementById('tool-risk').value) || 0;
    const sl       = parseFloat(document.getElementById('tool-sl').value) || 1;
    const pipVal   = parseFloat(document.getElementById('tool-pipval').value) || 10;

    const riskAmt  = balance * (risk / 100);
    const lots     = riskAmt / (sl * pipVal);
    const stopEur  = sl * pipVal * lots;

    document.getElementById('tool-amount').textContent  = UI.fmtCurrency(riskAmt, '$', 2);
    document.getElementById('tool-size').textContent    = lots.toFixed(2) + ' lotes';
    document.getElementById('tool-stop-eur').textContent= UI.fmtCurrency(stopEur, '$', 2);
  },

  calcPip() {
    const pipVal  = parseFloat(document.getElementById('pip-pair').value) || 10;
    const pips    = parseFloat(document.getElementById('pip-pips').value) || 0;
    const lots    = parseFloat(document.getElementById('pip-lots').value) || 0;
    const result  = pips * lots * pipVal;
    document.getElementById('pip-result').textContent = UI.fmtCurrency(result, '$', 2);
  },

  calcRR() {
    const entry = parseFloat(document.getElementById('rr-entry').value) || 0;
    const sl    = parseFloat(document.getElementById('rr-sl').value) || 0;
    const tp    = parseFloat(document.getElementById('rr-tp').value) || 0;

    const risk    = Math.abs(entry - sl);
    const reward  = Math.abs(tp - entry);
    const ratio   = risk > 0 ? reward / risk : 0;
    const minWR   = risk > 0 ? (1 / (1 + ratio)) * 100 : 0;

    document.getElementById('rr-ratio').textContent = `1:${ratio.toFixed(2)}`;
    document.getElementById('rr-minwr').textContent  = `${minWR.toFixed(1)}%`;
  },

  calcExpectancy() {
    const wr   = parseFloat(document.getElementById('exp-wr').value) / 100 || 0;
    const win  = parseFloat(document.getElementById('exp-win').value) || 0;
    const loss = parseFloat(document.getElementById('exp-loss').value) || 0;
    const exp  = (wr * win) - ((1 - wr) * loss);
    const el   = document.getElementById('exp-result');
    el.textContent = UI.pnlStr(exp);
    el.className   = 'calc-val ' + (exp >= 0 ? 'accent' : 'neg');
  },

  calcDDRecovery() {
    const dd      = parseFloat(document.getElementById('dd-pct').value) || 0;
    const capital = parseFloat(document.getElementById('dd-capital').value) || 0;
    const peak    = capital / (1 - dd / 100);
    const need    = peak > 0 ? ((peak - capital) / capital) * 100 : 0;
    const amount  = peak - capital;

    document.getElementById('dd-result').textContent = need.toFixed(2) + '%';
    document.getElementById('dd-amount').textContent  = UI.fmtCurrency(amount, '$', 0);
  },
};
