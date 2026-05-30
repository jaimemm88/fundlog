// ─── Diario de Trading ────────────────────────────────────────────────────────
const Journal = {
  _date:          new Date().toISOString().split('T')[0],
  _selectedMood:  '',
  _selectedMarket:'',
  _rulesFollowed:  1,
  _existing:       false,

  async load() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('journalDate').value = Journal._date;
    Journal._setupControls();
    await Journal._loadDay(Journal._date);
    await Journal._loadHistory();
    await Journal._loadMonthStats();
  },

  _setupControls() {
    document.getElementById('journalDate').addEventListener('change', e => {
      Journal._date = e.target.value;
      Journal._loadDay(Journal._date);
    });
    document.getElementById('journalPrevDay').addEventListener('click', () => {
      const d = new Date(Journal._date + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      Journal._date = d.toISOString().split('T')[0];
      document.getElementById('journalDate').value = Journal._date;
      Journal._loadDay(Journal._date);
    });
    document.getElementById('journalNextDay').addEventListener('click', () => {
      const d = new Date(Journal._date + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      Journal._date = d.toISOString().split('T')[0];
      document.getElementById('journalDate').value = Journal._date;
      Journal._loadDay(Journal._date);
    });
    document.getElementById('journalToday').addEventListener('click', () => {
      Journal._date = new Date().toISOString().split('T')[0];
      document.getElementById('journalDate').value = Journal._date;
      Journal._loadDay(Journal._date);
    });

    // Mood
    document.querySelectorAll('.mood-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.mood-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        Journal._selectedMood = opt.dataset.mood;
      });
    });

    // Market
    document.querySelectorAll('.market-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.market-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        Journal._selectedMarket = opt.dataset.market;
      });
    });

    // Rules toggle
    document.querySelectorAll('.rules-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rules-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Journal._rulesFollowed = parseInt(btn.dataset.val);
      });
    });

    // Save / Delete
    document.getElementById('btnSaveJournal').addEventListener('click', () => Journal.save());
    document.getElementById('btnDeleteJournal').addEventListener('click', () => Journal.delete());
  },

  async _loadDay(date) {
    const entry = await API.journal.getDay(date).catch(() => null);
    Journal._existing = !!entry;

    // Reset UI
    document.querySelectorAll('.mood-opt').forEach(o => o.classList.remove('selected'));
    document.querySelectorAll('.market-opt').forEach(o => o.classList.remove('selected'));
    document.getElementById('journalWentWell').value  = '';
    document.getElementById('journalWentWrong').value = '';
    document.getElementById('journalLessons').value   = '';
    document.getElementById('journalNotes').value     = '';
    document.getElementById('journalSavedMsg').style.display = 'none';

    if (entry) {
      Journal._selectedMood   = entry.mood;
      Journal._selectedMarket = entry.market_conditions;
      Journal._rulesFollowed  = entry.rules_followed;

      // Select mood
      if (entry.mood) {
        document.querySelectorAll('.mood-opt').forEach(o => {
          if (o.dataset.mood === entry.mood) o.classList.add('selected');
        });
      }
      // Select market
      if (entry.market_conditions) {
        document.querySelectorAll('.market-opt').forEach(o => {
          if (o.dataset.market === entry.market_conditions) o.classList.add('selected');
        });
      }
      // Rules
      document.querySelectorAll('.rules-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val) === entry.rules_followed);
      });

      document.getElementById('journalWentWell').value  = entry.went_well  || '';
      document.getElementById('journalWentWrong').value = entry.went_wrong || '';
      document.getElementById('journalLessons').value   = entry.lessons    || '';
      document.getElementById('journalNotes').value     = entry.notes      || '';
    } else {
      Journal._selectedMood   = '';
      Journal._selectedMarket = '';
      Journal._rulesFollowed  = 1;
      document.querySelectorAll('.rules-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    }

    // Show/hide delete button
    document.getElementById('btnDeleteJournal').style.display = entry ? 'inline-flex' : 'none';
  },

  async save() {
    const data = {
      date:              Journal._date,
      mood:              Journal._selectedMood,
      market_conditions: Journal._selectedMarket,
      went_well:         document.getElementById('journalWentWell').value.trim(),
      went_wrong:        document.getElementById('journalWentWrong').value.trim(),
      lessons:           document.getElementById('journalLessons').value.trim(),
      rules_followed:    Journal._rulesFollowed,
      notes:             document.getElementById('journalNotes').value.trim(),
    };

    try {
      await API.journal.save(data);
      const msg = document.getElementById('journalSavedMsg');
      msg.style.display = 'inline';
      setTimeout(() => msg.style.display = 'none', 2500);
      document.getElementById('btnDeleteJournal').style.display = 'inline-flex';
      Journal._existing = true;
      Journal._loadHistory();
      Journal._loadMonthStats();
    } catch(e) { UI.toast(e.message, 'error'); }
  },

  async delete() {
    if (!confirm('¿Eliminar esta entrada del diario?')) return;
    await API.journal.delete(Journal._date);
    UI.toast('Entrada eliminada', 'info');
    Journal._loadDay(Journal._date);
    Journal._loadHistory();
    Journal._loadMonthStats();
  },

  async _loadHistory() {
    const entries = await API.journal.list({}).catch(() => []);
    const el = document.getElementById('journalHistory');
    if (!entries.length) {
      el.innerHTML = '<p class="empty-state" style="padding:20px;">Aún no hay entradas</p>';
      return;
    }
    el.innerHTML = entries.slice(0, 10).map(e => {
      const preview = e.went_well || e.lessons || e.notes || '—';
      const rulesIcon = e.rules_followed ? '✅' : '❌';
      return `
        <div class="journal-entry" onclick="Journal._goTo('${e.date}')">
          <div class="journal-entry-mood">${e.mood || '📝'}</div>
          <div class="journal-entry-body">
            <div class="journal-entry-date">${UI.fmtDate(e.date)}</div>
            <div class="journal-entry-preview">${preview}</div>
            <div class="journal-entry-tags">
              ${e.market_conditions ? `<span class="journal-tag">${e.market_conditions}</span>` : ''}
              <span class="journal-tag">${rulesIcon} Reglas</span>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  async _loadMonthStats() {
    const now   = new Date();
    const from  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const entries = await API.journal.list({ from }).catch(() => []);
    const total   = entries.length;
    const rulesOk = entries.filter(e => e.rules_followed).length;
    const moods   = { '🔥': 0, '🎯': 0, '😐': 0, '😴': 0, '😤': 0 };
    entries.forEach(e => { if (moods[e.mood] !== undefined) moods[e.mood]++; });
    const topMood = Object.entries(moods).sort((a,b) => b[1]-a[1])[0];

    document.getElementById('journalMonthStats').innerHTML = `
      <div class="journal-month-grid">
        <div class="journal-month-stat">
          <div class="val">${total}</div>
          <div class="lbl">Entradas</div>
        </div>
        <div class="journal-month-stat">
          <div class="val" style="color:${rulesOk === total && total > 0 ? 'var(--green)' : 'var(--text-primary)'}">
            ${total > 0 ? Math.round(rulesOk/total*100) : 0}%
          </div>
          <div class="lbl">Reglas seguidas</div>
        </div>
        <div class="journal-month-stat">
          <div class="val" style="font-size:28px;">${topMood && topMood[1] > 0 ? topMood[0] : '—'}</div>
          <div class="lbl">Mood frecuente</div>
        </div>
        <div class="journal-month-stat">
          <div class="val">${entries.filter(e => e.lessons?.trim()).length}</div>
          <div class="lbl">Lecciones escritas</div>
        </div>
      </div>`;
  },

  _goTo(date) {
    Journal._date = date;
    document.getElementById('journalDate').value = date;
    Journal._loadDay(date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};
