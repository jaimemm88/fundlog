const express = require('express');
const path    = require('path');
const auth    = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas públicas (sin auth)
app.use('/api/auth', require('./routes/auth'));

// Rutas protegidas (requieren JWT)
app.use('/api/accounts',          auth, require('./routes/accounts'));
app.use('/api/trades',            auth, require('./routes/trades'));
app.use('/api/strategies',        auth, require('./routes/strategies'));
app.use('/api/funding',           auth, require('./routes/funding'));
app.use('/api/goals',             auth, require('./routes/goals'));
app.use('/api/analysis',          auth, require('./routes/analysis'));
app.use('/api/economic-calendar', auth, require('./routes/economic-calendar'));
app.use('/api/risk',              auth, require('./routes/risk'));

// Login page — cualquier ruta no-API sirve el index o login
app.get('/login', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'login.html'))
);
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 TradeVista corriendo en http://localhost:${PORT}\n`);
  autoSyncCalendar();
});

async function autoSyncCalendar() {
  try {
    const { getSetting, syncFromFinnhub } = require('./services/calendarSync');
    const apiKey = getSetting('FINNHUB_API_KEY');
    if (!apiKey) return;
    const lastSync = getSetting('LAST_ECO_SYNC');
    if (lastSync && Date.now() - new Date(lastSync).getTime() < 6 * 60 * 60 * 1000) {
      console.log('📅 Cal. Económico: sincronización reciente, omitiendo.');
      return;
    }
    console.log('📅 Sincronizando calendario económico...');
    const result = await syncFromFinnhub(apiKey, 4);
    console.log(`✅ Cal. Económico: ${result.inserted} nuevos, ${result.updated} actualizados.`);
  } catch (e) {
    console.log(`⚠️  Cal. Económico: ${e.message}`);
  }
}
setInterval(autoSyncCalendar, 6 * 60 * 60 * 1000);
