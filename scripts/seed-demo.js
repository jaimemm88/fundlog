// ─── Script de usuario demo para redes sociales ───────────────────────────────
const db     = require('../db');
const bcrypt = require('bcryptjs');

async function seedDemo() {
  // Eliminar si ya existe
  const existing = db.prepare("SELECT id FROM users WHERE email = 'demo@fundlog.es'").get();
  if (existing) {
    const uid = existing.id;
    db.prepare('DELETE FROM trades WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM accounts WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM strategies WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM goals WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM users WHERE id = ?').run(uid);
    console.log('Usuario demo anterior eliminado');
  }

  const hash     = await bcrypt.hash('usuario', 12);
  const trialEnd = new Date(Date.now() + 30*24*60*60*1000).toISOString();
  const uid = db.prepare(`
    INSERT INTO users (name, email, password, plan, trial_ends_at, nickname, trader_profile)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('Demo Trader', 'demo@fundlog.es', hash, 'pro', trialEnd, '@FundLogDemo', 'funded').lastInsertRowid;

  // Cuentas
  const insAcc = db.prepare(`INSERT INTO accounts (name, broker, platform, type, currency, initial_balance, balance, profit_target, user_id) VALUES (?,?,?,?,?,?,?,?,?)`);
  const a1 = insAcc.run('Orion Funded $50K',  'Orion Funded', 'MT5', 'funded', 'USD', 50000, 54820, 0,  uid).lastInsertRowid;
  const a2 = insAcc.run('FTMO Fase 2 $100K',  'FTMO',         'MT5', 'fase2',  'USD', 100000,104280,5, uid).lastInsertRowid;
  const a3 = insAcc.run('IC Markets Personal','IC Markets',   'MT5', 'propio', 'USD', 10000, 11240, 0,  uid).lastInsertRowid;

  // Estrategias
  const insS = db.prepare(`INSERT INTO strategies (name, market, timeframe, target_rr, description, status, user_id) VALUES (?,?,?,?,?,?,?)`);
  const s1 = insS.run('London Breakout',   'Forex',          'H1',  '1:3', 'Breakout del rango asiático en apertura de Londres', 'active', uid).lastInsertRowid;
  const s2 = insS.run('NY Open Momentum',  'Forex / Índices','M15', '1:2', 'Scalping en los primeros 30 min de NY', 'active', uid).lastInsertRowid;
  const s3 = insS.run('Gold Trend Follow', 'Materias primas','H4',  '1:4', 'Seguimiento de tendencia en XAU/USD', 'active', uid).lastInsertRowid;

  // Trades (mayo-junio 2026)
  const insT = db.prepare(`INSERT INTO trades (account_id, strategy_id, pair, type, entry_price, exit_price, size, pnl, date, session, result, notes, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const trades = [
    [a1, s1, 'EUR/USD',  'long',  1.0842, 1.0920, 2.0,  312,  '2026-06-01', 'london',  'win',  'Breakout limpio del rango asiático'],
    [a1, s2, 'GBP/USD',  'long',  1.2680, 1.2748, 1.5,  306,  '2026-05-31', 'ny',      'win',  ''],
    [a2, s3, 'XAU/USD',  'long',  2318,   2356,   0.5,  682,  '2026-05-30', 'london',  'win',  'Tendencia alcista, gestión perfecta'],
    [a1, s1, 'EUR/USD',  'short', 1.0950, 1.0918, 2.0,  180,  '2026-05-29', 'london',  'win',  ''],
    [a1, s2, 'NAS100',   'long',  18240,  18190,  0.3,  -412, '2026-05-28', 'ny',      'loss', 'Stop correcto, noticia sorpresa'],
    [a2, s1, 'GBP/JPY',  'long',  196.42, 197.35, 1.0,  695,  '2026-05-27', 'london',  'win',  ''],
    [a3, s2, 'EUR/USD',  'long',  1.0791, 1.0845, 0.5,  162,  '2026-05-26', 'overlap', 'win',  ''],
    [a1, s3, 'XAU/USD',  'short', 2345,   2318,   0.5,  486,  '2026-05-23', 'ny',      'win',  'Doble techo semanal'],
    [a2, s1, 'USD/JPY',  'long',  154.20, 154.88, 1.5,  612,  '2026-05-22', 'london',  'win',  ''],
    [a1, s2, 'EUR/USD',  'short', 1.0920, 1.0882, 2.0,  228,  '2026-05-21', 'ny',      'win',  'Divergencia bajista perfecta'],
    [a1, s1, 'EUR/USD',  'long',  1.0755, 1.0820, 2.0,  390,  '2026-05-20', 'london',  'win',  ''],
    [a2, s3, 'XAU/USD',  'long',  2290,   2318,   0.5,  504,  '2026-05-19', 'london',  'win',  ''],
    [a1, s2, 'GBP/USD',  'short', 1.2740, 1.2782, 1.5,  -378, '2026-05-16', 'ny',      'loss', 'Entrada anticipada'],
    [a2, s1, 'NASDAQ',   'long',  18050,  18240,  0.5,  570,  '2026-05-15', 'overlap', 'win',  'Breakout perfecto'],
    [a1, s3, 'XAU/USD',  'long',  2275,   2298,   0.5,  414,  '2026-05-14', 'london',  'win',  ''],
    [a1, s1, 'GBP/JPY',  'short', 197.80, 197.05, 1.0,  562,  '2026-05-13', 'london',  'win',  ''],
    [a3, s2, 'EUR/USD',  'long',  1.0720, 1.0768, 0.5,  144,  '2026-05-12', 'ny',      'win',  ''],
    [a2, s3, 'XAU/USD',  'short', 2340,   2310,   0.5,  540,  '2026-05-09', 'ny',      'win',  ''],
    [a1, s1, 'EUR/USD',  'long',  1.0700, 1.0762, 2.0,  372,  '2026-05-08', 'london',  'win',  ''],
    [a2, s2, 'NAS100',   'long',  18100,  18240,  0.3,  756,  '2026-05-07', 'ny',      'win',  'Apertura explosiva NY'],
    [a1, s1, 'GBP/USD',  'long',  1.2630, 1.2692, 1.5,  279,  '2026-05-06', 'london',  'win',  ''],
    [a1, s3, 'XAU/USD',  'long',  2260,   2280,   0.5,  360,  '2026-05-05', 'london',  'win',  ''],
    [a2, s1, 'USD/JPY',  'short', 155.20, 155.68, 1.5,  -432, '2026-05-02', 'ny',      'loss', 'Contra-tendencia'],
    [a1, s2, 'EUR/USD',  'long',  1.0680, 1.0752, 2.0,  432,  '2026-04-30', 'london',  'win',  ''],
    [a2, s3, 'XAU/USD',  'long',  2240,   2278,   0.5,  684,  '2026-04-29', 'london',  'win',  'Breakout histórico'],
    [a1, s1, 'GBP/JPY',  'long',  194.50, 195.42, 1.0,  690,  '2026-04-28', 'london',  'win',  ''],
    [a3, s2, 'EUR/USD',  'long',  1.0640, 1.0688, 0.5,  144,  '2026-04-25', 'ny',      'win',  ''],
    [a2, s2, 'NAS100',   'short', 18050,  17940,  0.5,  594,  '2026-04-24', 'ny',      'win',  'Rechazo zona oferta'],
    [a1, s1, 'EUR/USD',  'long',  1.0590, 1.0648, 2.0,  348,  '2026-04-23', 'london',  'win',  ''],
    [a2, s3, 'XAU/USD',  'long',  2225,   2258,   0.5,  594,  '2026-04-22', 'london',  'win',  ''],
  ];

  const insertAll = db.transaction(() => {
    for (const t of trades) insT.run(...t, uid);
  });
  insertAll();

  // Objetivos
  const insG = db.prepare(`INSERT INTO goals (name, metric, target_value, current_value, deadline, user_id) VALUES (?,?,?,?,?,?)`);
  insG.run('P&L mensual $5.000',  'pnl',     5000, 4820, '2026-06-30', uid);
  insG.run('Win rate 70%',        'winrate',  70,   73,   '2026-06-30', uid);
  insG.run('Pasar FTMO Fase 2',   'pnl',      5000, 4280, '2026-07-15', uid);
  insG.run('30 operaciones/mes',  'trades',   30,   28,   '2026-06-30', uid);

  console.log(`✅ Usuario demo creado — ${trades.length} operaciones, 3 cuentas, 3 estrategias`);
  console.log('   Email: demo@fundlog.es');
  console.log('   Contraseña: usuario');
  return uid;
}

module.exports = { seedDemo };

// Ejecutar directamente si se llama como script
if (require.main === module) {
  seedDemo().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
