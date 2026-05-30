// ─── Email Service (Resend) ───────────────────────────────────────────────────
const { Resend }     = require('resend');
const { getSetting } = require('./calendarSync');

function getResend() {
  const key = process.env.RESEND_API_KEY || getSetting('RESEND_API_KEY');
  console.log(`📧 RESEND_API_KEY presente: ${!!key} (${key ? key.substring(0,8)+'...' : 'no'})`);
  if (!key) throw new Error('RESEND_API_KEY no configurada en Render');
  return new Resend(key);
}

function getFromAddress() {
  // Usar solo el email sin display name para evitar problemas
  return process.env.RESEND_FROM || 'noreply@fundlog.es';
}

// ── Email: recordatorio de operaciones ───────────────────────────────────────
async function sendTradeReminder(user, daysMissed = 1) {
  const resend    = getResend();
  const firstName = user.name.split(' ')[0];
  const appUrl    = process.env.APP_URL || 'https://fundlog.es';

  const msg = daysMissed === 1
    ? 'Hoy no has registrado ninguna operación.'
    : `Llevas <strong>${daysMissed} días</strong> sin registrar operaciones.`;

  const html = emailTemplate({
    preview: `${firstName}, ¿ya tienes tus operaciones de hoy registradas?`,
    body: `
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0C1A2E;letter-spacing:-0.03em;">
        ¡Hola, ${firstName}! 👋
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B7A99;line-height:1.7;">
        ${msg} Llevar un journal constante es lo que diferencia a los traders que mejoran de los que no.
      </p>

      <div style="background:#F4F6FA;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:0.08em;">Recuerda anotar</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
          <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#0C1A2E;">
            <span style="font-size:18px;">📊</span> Tus operaciones de hoy con entrada, salida y P&L
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#0C1A2E;">
            <span style="font-size:18px;">📝</span> Una entrada en el Diario — qué fue bien y qué mejorar
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#0C1A2E;">
            <span style="font-size:18px;">🎯</span> Revisar tus objetivos del mes
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${appUrl}/app" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#152C4A,#2B72C8);color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:-0.01em;">
          → Registrar mis operaciones
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.6;border-top:1px solid #EEF1F8;padding-top:20px;">
        Los traders consistentes registran sus operaciones <em>cada día</em>, independientemente del resultado. Es el hábito más importante que puedes desarrollar.
      </p>
    `,
    appUrl,
  });

  await resend.emails.send({
    from:    getFromAddress(),
    to:      user.email,
    subject: `${firstName}, ¿ya tienes tus operaciones de hoy? 📊`,
    html,
  });
}

// ── Email: bienvenida al registrarse ─────────────────────────────────────────
async function sendWelcomeEmail(user) {
  const resend    = getResend();
  const firstName = user.name.split(' ')[0];
  const appUrl    = process.env.APP_URL || 'https://fundlog.es';

  const html = emailTemplate({
    preview: `Bienvenido a FundLog, ${firstName}. Tu journal de trading profesional está listo.`,
    body: `
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0C1A2E;letter-spacing:-0.03em;">
        ¡Bienvenido a FundLog, ${firstName}! 🚀
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#6B7A99;line-height:1.7;">
        Tu cuenta está lista. Ahora tienes acceso a un journal de trading profesional diseñado específicamente para prop firm traders.
      </p>

      <div style="background:#F4F6FA;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:0.08em;">Para empezar</p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:28px;height:28px;background:#EBF5FF;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#378ADD;flex-shrink:0;">1</div>
            <div><div style="font-size:14px;font-weight:600;color:#0C1A2E;margin-bottom:2px;">Añade tus cuentas</div><div style="font-size:13px;color:#6B7A99;">Fase 1, Fase 2 o Funded — con balance y objetivo</div></div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:28px;height:28px;background:#E1F5EE;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#1D9E75;flex-shrink:0;">2</div>
            <div><div style="font-size:14px;font-weight:600;color:#0C1A2E;margin-bottom:2px;">Importa tu historial</div><div style="font-size:13px;color:#6B7A99;">Exporta CSV de MT4/MT5 y súbelo en segundos</div></div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="width:28px;height:28px;background:#EEEDFE;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#534AB7;flex-shrink:0;">3</div>
            <div><div style="font-size:14px;font-weight:600;color:#0C1A2E;margin-bottom:2px;">Analiza y mejora</div><div style="font-size:13px;color:#6B7A99;">Descubre tus patrones con 35+ métricas profesionales</div></div>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${appUrl}/app" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#152C4A,#2B72C8);color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;">
          → Abrir FundLog
        </a>
      </div>
    `,
    appUrl,
  });

  await resend.emails.send({
    from:    getFromAddress(),
    to:      user.email,
    subject: `Bienvenido a FundLog, ${firstName} 🎯`,
    html,
  });
}

// ── Template base ─────────────────────────────────────────────────────────────
function emailTemplate({ preview, body, appUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FundLog</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F4F6FA;}</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
<div style="max-width:560px;margin:40px auto;padding:0 16px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#152C4A 0%,#1E3A5F 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
    <div style="display:inline-flex;align-items:center;gap:10px;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#1D3A5F,#378ADD);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;">
        <svg width="20" height="20" viewBox="0 0 38 38" fill="none"><path d="M7 29 L13 22 L19.5 25.5 L29.5 12" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="29.5" cy="12" r="3" fill="white"/></svg>
      </div>
      <span style="font-size:18px;font-weight:800;color:#EFF6FF;letter-spacing:-0.02em;"><span style="color:#fff;">Fund</span><span style="color:#85B7EB;">Log</span></span>
    </div>
  </div>

  <!-- Body -->
  <div style="background:#fff;padding:32px;border-left:1px solid #DDE3EF;border-right:1px solid #DDE3EF;">
    ${body}
  </div>

  <!-- Footer -->
  <div style="background:#F9FAFB;border:1px solid #DDE3EF;border-top:none;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
    <p style="font-size:12px;color:#94A3B8;line-height:1.6;margin-bottom:8px;">
      Recibes este email porque estás registrado en FundLog.<br>
      <a href="${appUrl}/app" style="color:#378ADD;text-decoration:none;">Gestionar preferencias</a> ·
      <a href="${appUrl}/app" style="color:#378ADD;text-decoration:none;">Darse de baja</a>
    </p>
    <p style="font-size:11px;color:#CBD5E0;">© 2026 FundLog · fundlog.es</p>
  </div>

</div>
</body></html>`;
}

module.exports = { sendTradeReminder, sendWelcomeEmail };
