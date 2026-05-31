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
  ['users', 'plan TEXT DEFAULT "trial"'],
  ['users', 'trial_ends_at TEXT DEFAULT ""'],
  ['users', 'reset_token TEXT DEFAULT ""'],
  ['users', 'reset_token_expires TEXT DEFAULT ""'],
  ['users', 'trader_profile TEXT DEFAULT ""'],
  ['accounts',          'user_id INTEGER DEFAULT 1'],
  ['trades',            'user_id INTEGER DEFAULT 1'],
  ['strategies',        'user_id INTEGER DEFAULT 1'],
  ['funding',           'user_id INTEGER DEFAULT 1'],
  ['goals',             'user_id INTEGER DEFAULT 1'],
  ['economic_calendar', 'user_id INTEGER DEFAULT 1'],
  ['economic_calendar', 'notes TEXT DEFAULT ""'],
  ['risk_settings',     'user_id INTEGER DEFAULT 1'],
  ['accounts',          'metaapi_id TEXT DEFAULT ""'],
  ['accounts',          'metaapi_state TEXT DEFAULT ""'],
  ['trades',            'external_id TEXT DEFAULT ""'],
  ['accounts',          'profit_target REAL DEFAULT 0'],
];
for (const [table, col] of migrations) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch {}
}


module.exports = db;
