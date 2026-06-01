// ─── Market Session Indicator ─────────────────────────────────────────────────
const MarketSession = {

  SESSIONS: [
    {
      id:    'tokyo',
      name:  'Tokio',
      flag:  '🇯🇵',
      color: '#7C6FCD',
      start: 0,   // UTC hours
      end:   9,
    },
    {
      id:    'london',
      name:  'Londres',
      flag:  '🇬🇧',
      color: '#378ADD',
      start: 8,
      end:   17,
    },
    {
      id:    'overlap',
      name:  'Overlap L/NY',
      flag:  '🔀',
      color: '#1D9E75',
      start: 13,
      end:   17,
    },
    {
      id:    'ny',
      name:  'Nueva York',
      flag:  '🇺🇸',
      color: '#E07A5A',
      start: 13,
      end:   22,
    },
  ],

  _timer: null,

  init() {
    MarketSession.update();
    MarketSession._timer = setInterval(MarketSession.update, 1000);
  },

  getActiveSession(utcHour, dayOfWeek) {
    // Fin de semana → cerrado
    if (dayOfWeek === 0 || dayOfWeek === 6) return null;
    // Viernes después de las 22 UTC → cerrado
    if (dayOfWeek === 5 && utcHour >= 22) return null;

    // Overlap tiene prioridad (London + NY simultáneas)
    if (utcHour >= 13 && utcHour < 17) {
      return MarketSession.SESSIONS.find(s => s.id === 'overlap');
    }
    // London (sin overlap)
    if (utcHour >= 8 && utcHour < 13) {
      return MarketSession.SESSIONS.find(s => s.id === 'london');
    }
    // London tarde (17-17 no, pero London cierra a las 17)
    // NY (sin overlap)
    if (utcHour >= 17 && utcHour < 22) {
      return MarketSession.SESSIONS.find(s => s.id === 'ny');
    }
    // Tokio
    if (utcHour >= 0 && utcHour < 8) {
      return MarketSession.SESSIONS.find(s => s.id === 'tokyo');
    }
    // Tokio nocturno (22-24 → preparación sesión asiática)
    if (utcHour >= 22) {
      return MarketSession.SESSIONS.find(s => s.id === 'tokyo');
    }
    return null;
  },

  _getTzName() {
    const saved = localStorage.getItem('tv_timezone') || 'auto';
    if (saved === 'auto') return Intl.DateTimeFormat().resolvedOptions().timeZone;
    return saved;
  },

  update() {
    const now  = new Date();
    const utcH = now.getUTCHours();
    const dow  = now.getUTCDay();
    const tz   = MarketSession._getTzName();

    const session = MarketSession.getActiveSession(utcH, dow);

    const pill    = document.getElementById('sessionPill');
    const dot     = document.getElementById('sessionDot');
    const flag    = document.getElementById('sessionFlag');
    const nameEl  = document.getElementById('sessionName');
    const clock   = document.getElementById('sessionClock');
    if (!pill) return;

    // Hora en la zona del usuario usando Intl (maneja DST automáticamente)
    const timeStr = now.toLocaleTimeString('es-ES', {
      timeZone: tz,
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   false,
    }) + ' ' + tz.split('/').pop().replace('_', ' ');

    if (!session) {
      pill.className      = 'session-pill session-closed';
      dot.style.background = '#6B7A99';
      flag.textContent    = '😴';
      nameEl.textContent  = 'Cerrado';
      clock.textContent   = timeStr;
      pill.style.setProperty('--session-color', '#6B7A99');
    } else {
      pill.className      = `session-pill session-${session.id}`;
      dot.style.background = session.color;
      flag.textContent    = session.flag;
      nameEl.textContent  = session.name;
      clock.textContent   = timeStr;
      pill.style.setProperty('--session-color', session.color);
    }
  },
};
