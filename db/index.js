const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'tradevista.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    broker          TEXT    DEFAULT '',
    platform        TEXT    DEFAULT '',
    type            TEXT    DEFAULT 'live',
    currency        TEXT    DEFAULT 'EUR',
    initial_balance REAL    DEFAULT 0,
    balance         REAL    DEFAULT 0,
    created_at      TEXT    DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS strategies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    market      TEXT DEFAULT '',
    timeframe   TEXT DEFAULT '',
    target_rr   TEXT DEFAULT '',
    description TEXT DEFAULT '',
    status      TEXT DEFAULT 'active',
    created_at  TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE SET NULL,
    pair        TEXT NOT NULL,
    type        TEXT NOT NULL,
    entry_price REAL DEFAULT 0,
    exit_price  REAL DEFAULT 0,
    size        REAL DEFAULT 0,
    pnl         REAL DEFAULT 0,
    date        TEXT NOT NULL,
    session     TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    result      TEXT DEFAULT 'win',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS funding (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    type       TEXT NOT NULL,
    amount     REAL NOT NULL,
    date       TEXT NOT NULL,
    notes      TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    metric        TEXT DEFAULT '',
    target_value  REAL DEFAULT 0,
    current_value REAL DEFAULT 0,
    deadline      TEXT DEFAULT '',
    status        TEXT DEFAULT 'active',
    created_at    TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS economic_calendar (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    date     TEXT NOT NULL,
    time     TEXT DEFAULT '',
    country  TEXT DEFAULT '',
    currency TEXT DEFAULT '',
    event    TEXT NOT NULL,
    impact   TEXT DEFAULT 'medium',
    previous TEXT DEFAULT '',
    forecast TEXT DEFAULT '',
    actual   TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS risk_settings (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id           INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    max_risk_per_trade   REAL    DEFAULT 1,
    max_daily_drawdown   REAL    DEFAULT 3,
    max_total_drawdown   REAL    DEFAULT 5,
    max_open_trades      INTEGER DEFAULT 5,
    max_daily_loss       REAL    DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS backtests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_name   TEXT DEFAULT '',
    pair            TEXT DEFAULT '',
    timeframe       TEXT DEFAULT '',
    start_date      TEXT DEFAULT '',
    end_date        TEXT DEFAULT '',
    initial_capital REAL DEFAULT 10000,
    risk_per_trade  REAL DEFAULT 1,
    total_trades    INTEGER DEFAULT 0,
    win_rate        REAL DEFAULT 0,
    profit_factor   REAL DEFAULT 0,
    total_pnl       REAL DEFAULT 0,
    max_drawdown    REAL DEFAULT 0,
    sharpe_ratio    REAL DEFAULT 0,
    equity_curve    TEXT DEFAULT '[]',
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Migraciones (añadir columnas si no existen) ─────────────────────────────
const migrations = [
  ['accounts',          'user_id INTEGER DEFAULT 1'],
  ['trades',            'user_id INTEGER DEFAULT 1'],
  ['strategies',        'user_id INTEGER DEFAULT 1'],
  ['funding',           'user_id INTEGER DEFAULT 1'],
  ['goals',             'user_id INTEGER DEFAULT 1'],
  ['economic_calendar', 'user_id INTEGER DEFAULT 1'],
  ['risk_settings',     'user_id INTEGER DEFAULT 1'],
  ['accounts',          'metaapi_id TEXT DEFAULT ""'],
  ['accounts',          'metaapi_state TEXT DEFAULT ""'],
  ['trades',            'external_id TEXT DEFAULT ""'],
];
for (const [table, col] of migrations) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch {}
}

// ─── Seed (only when DB is empty) ────────────────────────────────────────────

const accountCount = db.prepare('SELECT COUNT(*) as n FROM accounts').get().n;

if (accountCount === 0) {
  // Accounts
  const insAccount = db.prepare(`
    INSERT INTO accounts (name, broker, platform, type, currency, initial_balance, balance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const a1 = insAccount.run('Cuenta Principal', 'IC Markets', 'MT5', 'live', 'EUR', 10000, 12480).lastInsertRowid;
  const a2 = insAccount.run('Prop Firm FTMO', 'FTMO', 'MT4', 'prop', 'EUR', 50000, 52841).lastInsertRowid;
  const a3 = insAccount.run('Demo Crypto', 'Binance', 'Web', 'demo', 'USD', 10000, 9876).lastInsertRowid;

  // Strategies
  const insStrat = db.prepare(`
    INSERT INTO strategies (name, market, timeframe, target_rr, description, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const s1 = insStrat.run('Breakout Londres', 'Forex', 'H1', '1:2.5', 'Entradas en la apertura de Londres buscando breakout de los rangos asiáticos. Stop bajo el mínimo asiático.', 'active').lastInsertRowid;
  const s2 = insStrat.run('Reversión a la Media', 'Forex / Índices', 'M15', '1:2', 'Busca zonas de soporte/resistencia para operar reversiones con confirmación de vela. RSI divergencia.', 'active').lastInsertRowid;
  const s3 = insStrat.run('Scalping NY Open', 'Forex', 'M5', '1:1.5', 'Scalping en los primeros 30 min de apertura de NY. Alta volatilidad. Actualmente pausada para revisión.', 'paused').lastInsertRowid;

  // Trades (Mayo 2026 + Abril 2026)
  const insTrade = db.prepare(`
    INSERT INTO trades (account_id, strategy_id, pair, type, entry_price, exit_price, size, pnl, date, session, result, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const trades = [
    // Mayo 2026
    [a1, s1, 'EUR/USD',  'long',  1.0842, 1.0891, 0.5,  120,  '2026-05-27', 'london',  'win',  ''],
    [a1, s3, 'BTC/USD',  'short', 67420,  67890,  0.1,  -45,  '2026-05-26', 'ny',      'loss', 'Salida demasiado tarde'],
    [a2, s1, 'NASDAQ',   'long',  18240,  18480,  1.0,  210,  '2026-05-25', 'overlap', 'win',  'Breakout perfecto'],
    [a1, s2, 'GBP/JPY',  'short', 196.42, 195.91, 0.3,  88,   '2026-05-24', 'london',  'win',  ''],
    [a1, s1, 'USD/JPY',  'long',  154.20, 154.80, 0.5,  156,  '2026-05-23', 'london',  'win',  ''],
    [a1, s2, 'EUR/GBP',  'short', 0.8521, 0.8558, 0.5,  -62,  '2026-05-22', 'london',  'loss', 'Falsa ruptura'],
    [a2, s1, 'XAU/USD',  'long',  2318,   2341,   0.2,  174,  '2026-05-21', 'london',  'win',  ''],
    [a1, s2, 'EUR/USD',  'long',  1.0791, 1.0842, 0.5,  128,  '2026-05-20', 'overlap', 'win',  ''],
    [a1, s3, 'GBP/USD',  'short', 1.2690, 1.2650, 0.3,  72,   '2026-05-19', 'ny',      'win',  ''],
    [a1, s1, 'EUR/USD',  'long',  1.0755, 1.0800, 0.8,  198,  '2026-05-16', 'london',  'win',  ''],
    [a1, s2, 'USD/JPY',  'short', 155.10, 155.60, 0.3,  -89,  '2026-05-15', 'ny',      'loss', 'Noticias NFP'],
    [a2, s1, 'NASDAQ',   'long',  18050,  18220,  1.0,  160,  '2026-05-14', 'overlap', 'win',  ''],
    [a1, s2, 'EUR/USD',  'long',  1.0720, 1.0768, 0.5,  120,  '2026-05-13', 'london',  'win',  ''],
    [a1, s3, 'BTC/USD',  'long',  65800,  66400,  0.1,  180,  '2026-05-12', 'ny',      'win',  ''],
    [a1, s1, 'GBP/JPY',  'long',  194.80, 195.50, 0.4,  168,  '2026-05-09', 'london',  'win',  ''],
    [a1, s2, 'EUR/USD',  'short', 1.0830, 1.0870, 0.5,  -100, '2026-05-08', 'london',  'loss', ''],
    [a2, s1, 'XAU/USD',  'long',  2290,   2315,   0.3,  225,  '2026-05-07', 'london',  'win',  ''],
    [a1, s3, 'USD/JPY',  'long',  153.50, 154.10, 0.5,  132,  '2026-05-06', 'ny',      'win',  ''],
    [a1, s2, 'NASDAQ',   'short', 18200,  18100,  0.5,  95,   '2026-05-05', 'ny',      'win',  ''],
    [a1, s1, 'EUR/USD',  'long',  1.0700, 1.0760, 0.6,  180,  '2026-05-02', 'london',  'win',  ''],
    // Abril 2026
    [a1, s1, 'EUR/USD',  'long',  1.0680, 1.0740, 0.5,  150,  '2026-04-30', 'london',  'win',  ''],
    [a1, s2, 'GBP/USD',  'short', 1.2800, 1.2750, 0.5,  125,  '2026-04-29', 'london',  'win',  ''],
    [a2, s1, 'NASDAQ',   'long',  17800,  18050,  1.0,  235,  '2026-04-28', 'overlap', 'win',  'Fuerte impulso'],
    [a1, s3, 'BTC/USD',  'long',  64000,  63200,  0.1,  -240, '2026-04-25', 'ny',      'loss', 'Stop equivocado'],
    [a1, s2, 'EUR/USD',  'long',  1.0620, 1.0680, 0.5,  150,  '2026-04-24', 'london',  'win',  ''],
    [a1, s1, 'XAU/USD',  'long',  2260,   2290,   0.2,  180,  '2026-04-23', 'london',  'win',  ''],
    [a1, s2, 'USD/JPY',  'short', 152.80, 153.40, 0.4,  -144, '2026-04-22', 'ny',      'loss', ''],
    [a1, s1, 'GBP/JPY',  'long',  193.50, 194.80, 0.4,  312,  '2026-04-17', 'london',  'win',  ''],
    [a1, s2, 'EUR/USD',  'long',  1.0590, 1.0640, 0.6,  150,  '2026-04-16', 'london',  'win',  ''],
    [a1, s3, 'NASDAQ',   'short', 17900,  17800,  0.5,  95,   '2026-04-15', 'ny',      'win',  ''],
    [a1, s1, 'EUR/USD',  'long',  1.0560, 1.0610, 0.5,  125,  '2026-04-14', 'london',  'win',  ''],
    [a1, s2, 'BTC/USD',  'short', 63500,  64200,  0.1,  -210, '2026-04-11', 'ny',      'loss', 'Sesión muy volátil'],
    [a2, s1, 'XAU/USD',  'long',  2240,   2265,   0.3,  225,  '2026-04-10', 'london',  'win',  ''],
    [a1, s1, 'GBP/USD',  'long',  1.2650, 1.2720, 0.5,  175,  '2026-04-09', 'london',  'win',  ''],
    [a1, s2, 'EUR/USD',  'short', 1.0610, 1.0560, 0.5,  125,  '2026-04-08', 'ny',      'win',  ''],
  ];

  for (const t of trades) insTrade.run(...t);

  // Funding
  const insFunding = db.prepare(`
    INSERT INTO funding (account_id, type, amount, date, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  insFunding.run(a1, 'deposit',    5000,  '2026-05-15', 'Ampliación de capital');
  insFunding.run(a1, 'withdrawal', -1500, '2026-04-02', 'Retiro de beneficios Q1');
  insFunding.run(a1, 'deposit',    5000,  '2026-03-10', 'Depósito inicial Q2');
  insFunding.run(a1, 'withdrawal', -1300, '2026-02-15', 'Retiro mensual');
  insFunding.run(a1, 'deposit',    5000,  '2026-01-01', 'Depósito inicial del año');
  insFunding.run(a1, 'commission', -284,  '2026-05-27', 'Comisiones acumuladas 2026');

  // Goals
  const insGoal = db.prepare(`
    INSERT INTO goals (name, metric, target_value, current_value, deadline, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insGoal.run('P&L mensual €500', 'pnl',      500,  394,  '2026-05-31', 'active');
  insGoal.run('Win rate 65%',     'winrate',   65,   64,   '2026-05-31', 'active');
  insGoal.run('40 operaciones',   'trades',    40,   28,   '2026-05-31', 'active');
  insGoal.run('Max drawdown 5%',  'drawdown',  5,    2.1,  '2026-05-31', 'active');
  insGoal.run('Pasar challenge FTMO', 'pnl',  5000, 2841, '2026-06-15', 'active');
  insGoal.run('P&L Q1 €3000',    'pnl',      3000, 3000, '2026-03-31', 'completed');

  // Economic Calendar
  const insEco = db.prepare(`
    INSERT INTO economic_calendar (date, time, country, currency, event, impact, previous, forecast, actual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insEco.run('2026-05-28', '14:30', '🇺🇸', 'USD', 'PIB Q1 (Final)',            'high',   '2,1%',  '2,3%',  '');
  insEco.run('2026-05-28', '16:00', '🇺🇸', 'USD', 'Confianza del Consumidor',  'medium', '97,0',  '98,5',  '');
  insEco.run('2026-05-29', '09:00', '🇪🇺', 'EUR', 'IPC Eurozona (Flash)',       'high',   '2,2%',  '2,1%',  '');
  insEco.run('2026-05-30', '13:30', '🇺🇸', 'USD', 'Peticiones Desempleo',      'medium', '222K',  '218K',  '');
  insEco.run('2026-05-30', '14:30', '🇺🇸', 'USD', 'PCE Core (Inflación Fed)',  'high',   '2,6%',  '2,5%',  '');
  insEco.run('2026-06-02', '09:30', '🇬🇧', 'GBP', 'PMI Manufacturero',         'low',    '48,7',  '49,2',  '');
  insEco.run('2026-06-06', '14:30', '🇺🇸', 'USD', 'NFP (Nóminas no agrícolas)','high',   '177K',  '185K',  '');
  insEco.run('2026-06-11', '14:30', '🇺🇸', 'USD', 'IPC EE.UU. (Mayo)',         'high',   '3,4%',  '3,3%',  '');
  insEco.run('2026-06-12', '20:00', '🇺🇸', 'USD', 'Decisión Fed (Tipos)',       'high',   '5,25%', '5,00%', '');

  // Risk settings
  db.prepare(`
    INSERT INTO risk_settings (account_id, max_risk_per_trade, max_daily_drawdown, max_total_drawdown, max_open_trades, max_daily_loss)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(a1, 1, 3, 5, 5, 375);

  console.log('✅ Base de datos inicializada con datos de ejemplo');
}

module.exports = db;
