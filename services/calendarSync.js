// ─── Finnhub Economic Calendar Sync ─────────────────────────────────────────
const db = require('../db');

const COUNTRY_MAP = {
  US: { flag: '🇺🇸', currency: 'USD' },
  EU: { flag: '🇪🇺', currency: 'EUR' },
  GB: { flag: '🇬🇧', currency: 'GBP' },
  JP: { flag: '🇯🇵', currency: 'JPY' },
  CA: { flag: '🇨🇦', currency: 'CAD' },
  AU: { flag: '🇦🇺', currency: 'AUD' },
  CH: { flag: '🇨🇭', currency: 'CHF' },
  CN: { flag: '🇨🇳', currency: 'CNY' },
  DE: { flag: '🇩🇪', currency: 'EUR' },
  FR: { flag: '🇫🇷', currency: 'EUR' },
  NZ: { flag: '🇳🇿', currency: 'NZD' },
  NO: { flag: '🇳🇴', currency: 'NOK' },
  SE: { flag: '🇸🇪', currency: 'SEK' },
};

// Ensure settings table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  );
`);

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value || process.env[key] || '';
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

async function syncFromFinnhub(apiKey, weeks = 4) {
  const from = new Date().toISOString().split('T')[0];
  const toDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);
  const to = toDate.toISOString().split('T')[0];

  const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${apiKey}`;
  const res = await fetch(url);

  if (res.status === 401) throw new Error('API Key inválida. Comprueba tu clave de Finnhub.');
  if (res.status === 429) throw new Error('Límite de peticiones alcanzado. Espera un momento.');
  if (!res.ok) throw new Error(`Error de Finnhub: ${res.status}`);

  const data = await res.json();
  const events = data.economicCalendar || [];

  let inserted = 0, updated = 0;

  for (const ev of events) {
    if (!ev.time || !ev.event) continue;

    const [date, timeFull] = ev.time.split(' ');
    const time = timeFull ? timeFull.substring(0, 5) : '';
    const info = COUNTRY_MAP[ev.country] || { flag: '🌍', currency: ev.country || '' };
    const country = `${info.flag} ${info.currency}`;

    // Normalize impact: Finnhub uses 1/2/3 or high/medium/low
    let impact = String(ev.impact || '').toLowerCase();
    if (impact === '3' || impact === 'high')   impact = 'high';
    else if (impact === '2' || impact === 'medium') impact = 'medium';
    else impact = 'low';

    const existing = db.prepare(
      'SELECT id, actual FROM economic_calendar WHERE date = ? AND event = ?'
    ).get(date, ev.event);

    if (!existing) {
      db.prepare(`
        INSERT INTO economic_calendar (date, time, country, currency, event, impact, previous, forecast, actual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        date, time, country, info.currency, ev.event, impact,
        ev.prev     != null ? String(ev.prev)     : '',
        ev.estimate != null ? String(ev.estimate) : '',
        ev.actual   != null ? String(ev.actual)   : ''
      );
      inserted++;
    } else {
      // Update actual value and forecast if now available
      if (ev.actual != null && !existing.actual) {
        db.prepare('UPDATE economic_calendar SET actual=?, previous=?, forecast=? WHERE id=?')
          .run(String(ev.actual),
               ev.prev != null ? String(ev.prev) : '',
               ev.estimate != null ? String(ev.estimate) : '',
               existing.id);
        updated++;
      }
    }
  }

  // Store last sync time
  setSetting('LAST_ECO_SYNC', new Date().toISOString());

  return { total: events.length, inserted, updated, from, to };
}

module.exports = { syncFromFinnhub, getSetting, setSetting };
