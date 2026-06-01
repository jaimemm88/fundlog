const express = require('express');
const path    = require('path');
const auth    = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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
app.use('/api/journal',           auth, require('./routes/journal'));
// Stripe webhook necesita raw body ANTES del json parser — se registra dentro de la ruta
app.use('/api/stripe',                  require('./routes/stripe'));

// Login page — cualquier ruta no-API sirve el index o login
app.get('/',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/login',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.use('/api/admin',      require('./routes/admin'));
app.get('/admin',          (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
// Endpoint temporal para crear demo (solo con clave secreta)
app.get('/api/setup-demo', async (req, res) => {
  if (req.query.key !== 'fundlog2026') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { seedDemo } = require('./scripts/seed-demo');
    await seedDemo();
    res.json({ ok: true, email: 'demo@fundlog.es', password: 'usuario' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// Config pública para el frontend (solo claves públicas)
app.get('/api/config/cloudinary', (req, res) => res.json({
  cloud_name:    process.env.CLOUDINARY_CLOUD_NAME || '',
  upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
}));
app.get('/terminos',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'terminos.html')));
app.get('/privacidad',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacidad.html')));
app.get('/app',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*',      (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 FundLog corriendo en http://localhost:${PORT}\n`);
  autoSyncCalendar();
  // Iniciar scheduler de emails
  try {
    const { startScheduler } = require('./services/emailScheduler');
    startScheduler();
  } catch(e) {
    console.log('⚠️ Email scheduler:', e.message);
  }
});

async function autoSyncCalendar() {
  try {
    const { getSetting }      = require('./services/calendarSync');
    const { syncForexFactory } = require('./services/ffCalendar');
    const lastSync = getSetting('LAST_FF_SYNC');
    if (lastSync && Date.now() - new Date(lastSync).getTime() < 12 * 60 * 60 * 1000) {
      console.log('📅 Cal. Económico: sincronización reciente, omitiendo.');
      return;
    }
    console.log('📅 Sincronizando calendario económico (ForexFactory)...');
    const result = await syncForexFactory();
    console.log(`✅ Cal. Económico: ${result.total} eventos.`);
  } catch (e) {
    console.log(`⚠️  Cal. Económico: ${e.message}`);
  }
}
setInterval(autoSyncCalendar, 12 * 60 * 60 * 1000);
