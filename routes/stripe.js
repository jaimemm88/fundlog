// ─── Stripe Payments ──────────────────────────────────────────────────────────
const router  = require('express').Router();
const db      = require('../db');
const express = require('express');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurada');
  return require('stripe')(key);
}

// Añadir columnas si no existen
try { db.exec('ALTER TABLE users ADD COLUMN stripe_customer_id TEXT DEFAULT ""'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT DEFAULT ""'); } catch(e) {}

// ── Crear sesión de checkout ───────────────────────────────────────────────────
router.post('/checkout', require('../middleware/auth'), async (req, res) => {
  try {
    const stripe   = getStripe();
    const user     = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const priceId  = process.env.STRIPE_PRICE_ID;
    const appUrl   = process.env.APP_URL || 'https://fundlog.es';

    if (!priceId) return res.status(500).json({ error: 'STRIPE_PRICE_ID no configurada' });

    // Crear o recuperar customer de Stripe
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.name,
        metadata: { user_id: String(user.id) },
      });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);
    }

    // Crear sesión de checkout con trial de 7 días
    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: String(user.id) },
      },
      success_url: `${appUrl}/app?payment=success`,
      cancel_url:  `${appUrl}/app?payment=cancelled`,
      locale:      'es',
      metadata:    { user_id: String(user.id) },
    });

    res.json({ url: session.url });
  } catch(e) {
    console.error('Stripe checkout error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Portal de cliente (gestionar suscripción / cancelar) ───────────────────────
router.post('/portal', require('../middleware/auth'), async (req, res) => {
  try {
    const stripe = getStripe();
    const user   = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const appUrl = process.env.APP_URL || 'https://fundlog.es';

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No tienes una suscripción activa' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${appUrl}/app`,
    });

    res.json({ url: session.url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Webhook de Stripe (eventos de suscripción) ────────────────────────────────
// IMPORTANTE: usar raw body para verificar firma
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig    = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) return res.status(400).send('STRIPE_WEBHOOK_SECRET no configurada');

    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch(e) {
      console.error('Webhook signature error:', e.message);
      return res.status(400).send(`Webhook error: ${e.message}`);
    }

    const sub  = event.data.object;
    const meta = sub.metadata || {};
    const userId = meta.user_id
      ? parseInt(meta.user_id)
      : (sub.customer ? db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(sub.customer)?.id : null);

    if (!userId) {
      console.log('Webhook: usuario no encontrado para', event.type);
      return res.json({ received: true });
    }

    console.log(`📦 Stripe webhook: ${event.type} — user ${userId}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        if (sub.status === 'active' || sub.status === 'trialing') {
          db.prepare('UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE id = ?')
            .run('pro', sub.id, userId);
          console.log(`✅ Plan PRO activado para user ${userId}`);
        }
        break;

      case 'customer.subscription.deleted':
        db.prepare('UPDATE users SET plan = ?, stripe_subscription_id = "" WHERE id = ?')
          .run('trial', userId);
        console.log(`❌ Suscripción cancelada para user ${userId}`);
        break;

      case 'invoice.payment_failed':
        console.log(`⚠️  Pago fallido para user ${userId}`);
        break;
    }

    res.json({ received: true });
  }
);

module.exports = router;
