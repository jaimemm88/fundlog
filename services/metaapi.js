// ─── MetaApi Integration Service ─────────────────────────────────────────────
const { getSetting } = require('./calendarSync');
const db = require('../db');

// Añadir columnas necesarias si no existen
try {
  db.exec(`ALTER TABLE accounts ADD COLUMN metaapi_id TEXT DEFAULT ''`);
} catch(e) { /* ya existe */ }
try {
  db.exec(`ALTER TABLE accounts ADD COLUMN metaapi_state TEXT DEFAULT ''`);
} catch(e) { /* ya existe */ }
try {
  db.exec(`ALTER TABLE trades ADD COLUMN external_id TEXT DEFAULT ''`);
} catch(e) { /* ya existe */ }

function getMetaApi() {
  const token = getSetting('METAAPI_TOKEN');
  if (!token) throw new Error('MetaApi token no configurado');
  const MetaApi = require('metaapi.cloud-sdk').default;
  return new MetaApi(token);
}

// Sesión de trade: mapea los deals de MT en operaciones completas (entrada + salida)
function mapDealsToTrades(deals, accountId) {
  const sessionMap = {};
  const result = [];

  // Agrupar deals por positionId
  for (const d of deals) {
    if (!d.positionId) continue;
    if (!sessionMap[d.positionId]) sessionMap[d.positionId] = [];
    sessionMap[d.positionId].push(d);
  }

  for (const [posId, dls] of Object.entries(sessionMap)) {
    const opening = dls.find(d => d.entryType === 'DEAL_ENTRY_IN');
    const closing = dls.find(d => d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT');
    if (!closing) continue;

    const pnl = parseFloat(closing.profit || 0) + parseFloat(closing.swap || 0) + parseFloat(closing.commission || 0);
    const isBuy = (opening?.type === 'DEAL_TYPE_BUY') || (closing?.type === 'DEAL_TYPE_BUY');
    const closeTime = closing.time ? new Date(closing.time) : new Date();
    const date = closeTime.toISOString().split('T')[0];
    const symbol = (closing.symbol || opening?.symbol || '').replace('_SB', '');

    result.push({
      account_id:   accountId,
      strategy_id:  null,
      pair:         symbol,
      type:         isBuy ? 'long' : 'short',
      entry_price:  opening?.price  || closing.price || 0,
      exit_price:   closing.price   || 0,
      size:         closing.volume  || opening?.volume || 0,
      pnl:          parseFloat(pnl.toFixed(2)),
      date,
      session:      getSession(closeTime),
      result:       pnl >= 0 ? 'win' : 'loss',
      notes:        `MT sync · pos#${posId}`,
      external_id:  posId,
    });
  }

  return result;
}

function getSession(date) {
  const h = date.getUTCHours();
  if (h >= 0  && h < 8)  return 'tokyo';
  if (h >= 8  && h < 12) return 'london';
  if (h >= 12 && h < 16) return 'overlap';
  return 'ny';
}

// ── Provisionar cuenta MT en MetaApi ─────────────────────────────────────────
async function provisionAccount({ name, login, password, server, platform, accountId }) {
  const api = getMetaApi();

  let maAccount;
  if (accountId) {
    // Ya existe en MetaApi, solo actualizamos estado
    maAccount = await api.metatraderAccountApi.getAccount(accountId);
  } else {
    maAccount = await api.metatraderAccountApi.createAccount({
      name:     name || `${login}@${server}`,
      type:     'cloud',
      login:    String(login),
      password,
      server,
      platform: platform || 'mt5',
      magic:    0,
    });
    // Desplegar la cuenta (inicia la conexión con el broker)
    await maAccount.deploy();
  }

  return {
    metaapi_id:    maAccount.id,
    metaapi_state: maAccount.state,
    connection_status: maAccount.connectionStatus,
  };
}

// ── Obtener estado de una cuenta ──────────────────────────────────────────────
async function getAccountStatus(metaapiId) {
  const api = getMetaApi();
  const acc = await api.metatraderAccountApi.getAccount(metaapiId);
  return {
    state: acc.state,
    connection_status: acc.connectionStatus,
    broker: acc.broker,
    currency: acc.currency,
    balance: acc.balance,
    equity: acc.equity,
  };
}

// ── Sincronizar historial de operaciones ──────────────────────────────────────
async function syncHistory(metaapiId, localAccountId, daysBack = 90) {
  const api   = getMetaApi();
  const acc   = await api.metatraderAccountApi.getAccount(metaapiId);

  if (acc.state !== 'DEPLOYED') {
    await acc.deploy();
    await acc.waitDeployed(60);
  }

  const conn = acc.getRPCConnection();
  await conn.connect();
  await conn.waitSynchronized({ timeoutInSeconds: 120 });

  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const to   = new Date();

  const { deals } = await conn.getDealsByTimeRange(from, to);
  await conn.close();

  const trades = mapDealsToTrades(deals || [], localAccountId);

  // Insertar evitando duplicados por external_id
  const insert = db.prepare(`
    INSERT OR IGNORE INTO trades
      (account_id, strategy_id, pair, type, entry_price, exit_price, size, pnl, date, session, result, notes, external_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let inserted = 0;
  for (const t of trades) {
    // Verificar que no exista ya
    const exists = db.prepare('SELECT id FROM trades WHERE external_id = ? AND external_id != ""').get(t.external_id);
    if (exists) continue;
    insert.run(t.account_id, t.strategy_id, t.pair, t.type, t.entry_price, t.exit_price, t.size, t.pnl, t.date, t.session, t.result, t.notes, t.external_id);
    // Actualizar balance de la cuenta
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(t.pnl, localAccountId);
    inserted++;
  }

  return { total: trades.length, inserted };
}

module.exports = { provisionAccount, getAccountStatus, syncHistory };
