// ─── ForexFactory Calendar Sync ──────────────────────────────────────────────
const { XMLParser } = require('fast-xml-parser');
const db = require('../db');

const FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭',
  CNY: '🇨🇳', CNH: '🇨🇳',
};

const IMPACT_MAP = {
  High: 'high', Medium: 'medium', Low: 'low', Holiday: 'low',
};

// Convierte "05-30-2026" → "2026-05-30"
function parseDate(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  return null;
}

// Convierte "2:30pm" → "14:30"
function parseTime(raw) {
  if (!raw) return '';
  const m = String(raw).match(/(\d+):(\d+)(am|pm)/i);
  if (!m) return String(raw).substring(0, 5);
  let h = parseInt(m[1]);
  const min = m[2];
  const ampm = m[3].toLowerCase();
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

async function fetchWeek(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FF feed error: ${res.status}`);

  // El feed usa windows-1252 pero lo leemos como latin1
  const buf  = await res.arrayBuffer();
  const text = new TextDecoder('windows-1252').decode(buf);

  const parser = new XMLParser({
    ignoreAttributes: false,
    cdataPropName:    '__cdata',
    allowBooleanAttributes: true,
  });
  const parsed = parser.parse(text);
  return parsed?.weeklyevents?.event || [];
}

function getText(val) {
  if (!val) return '';
  if (typeof val === 'object' && val.__cdata !== undefined) return String(val.__cdata).trim();
  return String(val).trim();
}

async function syncForexFactory() {
  const urls = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.xml',
    'https://nfs.faireconomy.media/ff_calendar_nextweek.xml',
  ];

  // Limpiar eventos futuros de FF (los recreamos frescos)
  const today = new Date().toISOString().split('T')[0];
  db.prepare("DELETE FROM economic_calendar WHERE date >= ? AND (notes = 'ff' OR notes IS NULL OR notes = '')").run(today);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO economic_calendar
      (date, time, country, currency, event, impact, previous, forecast, actual, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ff')
  `);

  let total = 0;

  for (const url of urls) {
    try {
      const events = await fetchWeek(url);
      const list   = Array.isArray(events) ? events : [events];

      for (const ev of list) {
        const country  = getText(ev.country);
        const title    = getText(ev.title);
        const dateRaw  = getText(ev.date);
        const timeRaw  = getText(ev.time);
        const impactRaw= getText(ev.impact);
        const forecast = getText(ev.forecast);
        const previous = getText(ev.previous);
        const actual   = getText(ev.actual);

        if (!country || !title || !dateRaw) continue;

        const date   = parseDate(dateRaw);
        const time   = parseTime(timeRaw);
        const impact = IMPACT_MAP[impactRaw] || 'low';
        const flag   = FLAGS[country] || '🌍';
        const countryLabel = `${flag} ${country}`;

        if (!date) continue;

        insert.run(date, time, countryLabel, country, title, impact, previous, forecast, actual || '');
        total++;
      }
    } catch(e) {
      console.log(`⚠️ FF sync error for ${url}: ${e.message}`);
    }
  }

  // Guardar timestamp
  const { setSetting } = require('./calendarSync');
  setSetting('LAST_FF_SYNC', new Date().toISOString());

  console.log(`✅ ForexFactory: ${total} eventos sincronizados`);
  return { total };
}

module.exports = { syncForexFactory };
