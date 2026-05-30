const router  = require('express').Router();
const db       = require('../db');
const { getSetting } = require('../services/calendarSync');

// ── Verificar si MetaApi está configurado ─────────────────────────────────────
router.get('/status', (req, res) => {
  const token = getSetting('METAAPI_TOKEN');
  res.json({ configured: !!token });
});

// ── Listar cuentas MT vinculadas ──────────────────────────────────────────────
router.get('/accounts', (req, res) => {
  const rows = db.prepare(
    `SELECT id, name, broker, platform, type, currency, balance, metaapi_id, metaapi_state
     FROM accounts WHERE metaapi_id != '' AND metaapi_id IS NOT NULL`
  ).all();
  res.json(rows);
});

// ── Conectar nueva cuenta MT ──────────────────────────────────────────────────
router.post('/connect', async (req, res) => {
  const { name, login, password, server, platform } = req.body;
  if (!login || !password || !server) {
    return res.status(400).json({ error: 'login, password y server son obligatorios' });
  }

  try {
    const { provisionAccount } = require('../services/metaapi');
    const result = await provisionAccount({ name, login, password, server, platform });

    // Crear o actualizar cuenta en nuestra DB
    const existing = db.prepare('SELECT id FROM accounts WHERE metaapi_id = ?').get(result.metaapi_id);
    let accountId;

    if (existing) {
      db.prepare('UPDATE accounts SET metaapi_state = ? WHERE id = ?')
        .run(result.metaapi_state, existing.id);
      accountId = existing.id;
    } else {
      const r = db.prepare(`
        INSERT INTO accounts (name, broker, platform, type, currency, initial_balance, balance, metaapi_id, metaapi_state)
        VALUES (?, ?, ?, ?, 'EUR', 0, 0, ?, ?)
      `).run(
        name || `MT${login}`, server, platform || 'MT5', 'live',
        result.metaapi_id, result.metaapi_state
      );
      accountId = r.lastInsertRowid;
    }

    res.json({ ok: true, accountId, ...result, message: 'Cuenta conectada. Ahora sincroniza el historial.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Estado de una cuenta MT ───────────────────────────────────────────────────
router.get('/accounts/:metaapiId/status', async (req, res) => {
  try {
    const { getAccountStatus } = require('../services/metaapi');
    const status = await getAccountStatus(req.params.metaapiId);

    // Actualizar estado en DB
    db.prepare('UPDATE accounts SET metaapi_state = ? WHERE metaapi_id = ?')
      .run(status.state, req.params.metaapiId);

    // Actualizar balance/equity si están disponibles
    if (status.balance) {
      db.prepare('UPDATE accounts SET balance = ? WHERE metaapi_id = ?')
        .run(status.balance, req.params.metaapiId);
    }

    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Sincronizar historial de operaciones ──────────────────────────────────────
router.post('/accounts/:metaapiId/sync', async (req, res) => {
  try {
    const account = db.prepare('SELECT id FROM accounts WHERE metaapi_id = ?').get(req.params.metaapiId);
    if (!account) return res.status(404).json({ error: 'Cuenta no encontrada en TradeVista' });

    const { syncHistory } = require('../services/metaapi');
    const daysBack = parseInt(req.body.days_back) || 90;
    const result   = await syncHistory(req.params.metaapiId, account.id, daysBack);

    res.json({ ok: true, ...result, message: `${result.inserted} operaciones importadas de ${result.total} encontradas` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Desconectar cuenta MT ─────────────────────────────────────────────────────
router.delete('/accounts/:metaapiId', async (req, res) => {
  try {
    db.prepare(`UPDATE accounts SET metaapi_id = '', metaapi_state = '' WHERE metaapi_id = ?`)
      .run(req.params.metaapiId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
