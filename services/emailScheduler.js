// ─── Email Scheduler — recordatorios diarios ──────────────────────────────────
const cron = require('node-cron');
const db   = require('../db');
const { getSetting } = require('./calendarSync');

async function sendDailyReminders() {
  const key = process.env.RESEND_API_KEY || getSetting('RESEND_API_KEY');
  if (!key) return; // Sin API key, no enviar

  const { sendTradeReminder } = require('./mailer');

  const today     = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDays   = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

  // Obtener todos los usuarios activos (registrados hace más de 1 día)
  const users = db.prepare(`
    SELECT * FROM users
    WHERE created_at < datetime('now', '-1 day')
  `).all();

  let sent = 0;

  for (const user of users) {
    try {
      // ¿Ha metido operaciones hoy?
      const todayTrades = db.prepare(
        'SELECT COUNT(*) as n FROM trades WHERE user_id = ? AND date = ?'
      ).get(user.id, today);

      if (todayTrades.n > 0) continue; // Ya operó hoy, no molestar

      // ¿Cuándo fue su última operación?
      const lastTrade = db.prepare(
        'SELECT date FROM trades WHERE user_id = ? ORDER BY date DESC LIMIT 1'
      ).get(user.id);

      // Solo avisar si llevaba también sin registrar ayer (2 días sin actividad)
      if (!lastTrade || lastTrade.date >= yesterday) continue;

      // Calcular días sin actividad
      const lastDate  = new Date(lastTrade.date);
      const todayDate = new Date(today);
      const daysMissed = Math.round((todayDate - lastDate) / 86400000);

      // No molestar más de una vez cada 3 días si lleva mucho tiempo inactivo
      if (daysMissed > 7 && daysMissed % 3 !== 0) continue;
      // No molestar si lleva más de 30 días sin actividad (probablemente abandonó)
      if (daysMissed > 30) continue;

      await sendTradeReminder(user, daysMissed);
      sent++;
      console.log(`📧 Recordatorio enviado a ${user.email} (${daysMissed} días sin ops.)`);

      // Pequeña pausa para no saturar la API
      await new Promise(r => setTimeout(r, 200));
    } catch(e) {
      console.log(`⚠️ Error enviando email a ${user.email}: ${e.message}`);
    }
  }

  if (sent > 0) console.log(`✅ Emails enviados: ${sent}`);
}

function startScheduler() {
  // Todos los días a las 20:00 hora España (19:00 UTC en verano)
  cron.schedule('0 19 * * 1-5', async () => {
    console.log('📧 Ejecutando recordatorios diarios...');
    await sendDailyReminders();
  }, { timezone: 'Europe/Madrid' });

  console.log('📧 Scheduler de emails activo (L-V 20:00)');
}

module.exports = { startScheduler, sendDailyReminders };
