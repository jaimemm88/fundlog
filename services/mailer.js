// ─── Email Service (Resend) ───────────────────────────────────────────────────
const { Resend }     = require('resend');
const { getSetting } = require('./calendarSync');

function getResend() {
  const key = process.env.RESEND_API_KEY || getSetting('RESEND_API_KEY');
  console.log(`📧 RESEND_API_KEY presente: ${!!key} (${key ? key.substring(0,8)+'...' : 'no'})`);
  if (!key) throw new Error('RESEND_API_KEY no configurada en Render');
  return new Resend(key);
}

function getFrom() {
  return process.env.RESEND_FROM || 'noreply@fundlog.es';
}

// ── Email: bienvenida ─────────────────────────────────────────────────────────
async function sendWelcomeEmail(user) {
  const resend    = getResend();
  const firstName = user.name.split(' ')[0];
  const appUrl    = process.env.APP_URL || 'https://fundlog.es';

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bienvenido a FundLog</title></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;color:#F0F4F8;">Bienvenido a FundLog, ${firstName}. Tu journal de trading profesional está listo.</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#0F2040;border-radius:16px 16px 0 0;padding:28px 40px;text-align:center;">
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="background:#1D4080;border-radius:10px;width:38px;height:38px;text-align:center;vertical-align:middle;padding:0 10px;">
          <span style="font-size:20px;color:#fff;font-weight:800;font-family:Georgia,serif;">f</span>
        </td>
        <td style="padding-left:12px;">
          <span style="font-size:24px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:-0.5px;">Fund</span><span style="font-size:24px;font-weight:800;color:#7DB8E8;font-family:Arial,sans-serif;letter-spacing:-0.5px;">Log</span>
        </td>
      </tr>
    </table>
    <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:10px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Trading Journal</div>
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:#ffffff;padding:40px 40px 32px;">
    <div style="font-size:28px;font-weight:800;color:#0C1A2E;letter-spacing:-0.5px;margin-bottom:12px;">
      ¡Bienvenido, ${firstName}! 🎯
    </div>
    <p style="font-size:15px;color:#6B7A99;line-height:1.7;margin:0 0 28px;">
      Tu cuenta en FundLog está lista. Ahora tienes acceso a un journal de trading profesional diseñado para prop firm traders que quieren mejorar de verdad.
    </p>

    <!-- 3 PASOS en tabla -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td width="33%" valign="top" style="padding:16px 8px 16px 0;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="background:#EBF5FF;border-radius:10px;padding:16px;text-align:center;">
              <div style="width:36px;height:36px;background:#378ADD;border-radius:50%;margin:0 auto 10px;line-height:36px;font-size:16px;font-weight:800;color:#fff;">1</div>
              <div style="font-size:13px;font-weight:700;color:#0C1A2E;margin-bottom:4px;">Añade tus cuentas</div>
              <div style="font-size:11.5px;color:#6B7A99;line-height:1.5;">Fase 1, Fase 2 o Funded con balance y objetivo</div>
            </td></tr>
          </table>
        </td>
        <td width="33%" valign="top" style="padding:16px 4px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="background:#E1F5EE;border-radius:10px;padding:16px;text-align:center;">
              <div style="width:36px;height:36px;background:#1D9E75;border-radius:50%;margin:0 auto 10px;line-height:36px;font-size:16px;font-weight:800;color:#fff;">2</div>
              <div style="font-size:13px;font-weight:700;color:#0C1A2E;margin-bottom:4px;">Importa tu historial</div>
              <div style="font-size:11.5px;color:#6B7A99;line-height:1.5;">Exporta CSV de MT4/MT5 y súbelo en segundos</div>
            </td></tr>
          </table>
        </td>
        <td width="33%" valign="top" style="padding:16px 0 16px 8px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="background:#EEEDFE;border-radius:10px;padding:16px;text-align:center;">
              <div style="width:36px;height:36px;background:#534AB7;border-radius:50%;margin:0 auto 10px;line-height:36px;font-size:16px;font-weight:800;color:#fff;">3</div>
              <div style="font-size:13px;font-weight:700;color:#0C1A2E;margin-bottom:4px;">Analiza y mejora</div>
              <div style="font-size:11.5px;color:#6B7A99;line-height:1.5;">35+ métricas para mejorar tu rendimiento</div>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${appUrl}/app" style="display:inline-block;background:linear-gradient(135deg,#1A3A6A,#2B72C8);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:-0.2px;">
          → Abrir FundLog ahora
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FEATURES STRIP -->
  <tr><td style="background:#F8FAFB;border-top:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5;padding:24px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="25%" align="center" style="padding:0 8px;">
          <div style="font-size:20px;margin-bottom:4px;">📊</div>
          <div style="font-size:11px;font-weight:700;color:#0C1A2E;">Análisis avanzado</div>
        </td>
        <td width="25%" align="center" style="padding:0 8px;">
          <div style="font-size:20px;margin-bottom:4px;">🛡️</div>
          <div style="font-size:11px;font-weight:700;color:#0C1A2E;">Gestión de riesgo</div>
        </td>
        <td width="25%" align="center" style="padding:0 8px;">
          <div style="font-size:20px;margin-bottom:4px;">📅</div>
          <div style="font-size:11px;font-weight:700;color:#0C1A2E;">Cal. económico</div>
        </td>
        <td width="25%" align="center" style="padding:0 8px;">
          <div style="font-size:20px;margin-bottom:4px;">📔</div>
          <div style="font-size:11px;font-weight:700;color:#0C1A2E;">Diario de trading</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0F2040;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:rgba(255,255,255,0.35);margin:0 0 8px;line-height:1.6;">
      Recibiste este email porque te registraste en FundLog.<br>
      <a href="${appUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">fundlog.es</a>
    </p>
    <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">© 2026 FundLog · Todos los derechos reservados</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const r2 = await resend.emails.send({
    from:    getFrom(),
    to:      user.email,
    subject: `¡Bienvenido a FundLog, ${firstName}! 🚀`,
    html,
  });
  console.log('📧 Resend welcome result:', JSON.stringify(r2));
  if (r2.error) throw new Error(r2.error.message || JSON.stringify(r2.error));
}

// ── Email: recordatorio operaciones ──────────────────────────────────────────
async function sendTradeReminder(user, daysMissed = 1) {
  const resend    = getResend();
  const firstName = user.name.split(' ')[0];
  const appUrl    = process.env.APP_URL || 'https://fundlog.es';

  const msg = daysMissed === 1
    ? 'Hoy no has registrado ninguna operación en FundLog.'
    : `Llevas <strong>${daysMissed} días</strong> sin registrar operaciones.`;

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recordatorio FundLog</title></head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;color:#F0F4F8;">${firstName}, ¿ya tienes tus operaciones de hoy registradas?</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0F2040 0%,#1A3A6A 100%);border-radius:16px 16px 0 0;padding:28px 40px;text-align:center;">
    <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;">
      <span style="color:#ffffff;">Fund</span><span style="color:#7DB8E8;">Log</span>
    </div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#ffffff;padding:36px 40px;">
    <div style="font-size:24px;font-weight:800;color:#0C1A2E;margin-bottom:12px;">
      ¡Hola, ${firstName}! 👋
    </div>
    <p style="font-size:15px;color:#6B7A99;line-height:1.7;margin:0 0 24px;">${msg} Los mejores traders registran sus operaciones cada día, independientemente del resultado.</p>

    <!-- RECORDATORIO BOX -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFB;border:1px solid #E8EDF5;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:11px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Recuerda anotar hoy</div>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="padding:6px 0;font-size:14px;color:#0C1A2E;">
            <span style="font-size:17px;margin-right:10px;">📊</span> Tus operaciones con entrada, salida y P&L
          </td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#0C1A2E;">
            <span style="font-size:17px;margin-right:10px;">📔</span> Una entrada en el Diario — qué fue bien y qué mejorar
          </td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#0C1A2E;">
            <span style="font-size:17px;margin-right:10px;">🎯</span> Revisar tus objetivos del mes
          </td></tr>
        </table>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${appUrl}/app" style="display:inline-block;background:linear-gradient(135deg,#1A3A6A,#2B72C8);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:10px;font-size:15px;font-weight:700;">
          → Registrar mis operaciones
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0F2040;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
    <p style="font-size:12px;color:rgba(255,255,255,0.35);margin:0 0 6px;">
      <a href="${appUrl}" style="color:rgba(255,255,255,0.5);text-decoration:underline;">fundlog.es</a>
    </p>
    <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">© 2026 FundLog</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const r1 = await resend.emails.send({
    from:    getFrom(),
    to:      user.email,
    subject: `${firstName}, ¿ya registraste tus operaciones de hoy? 📊`,
    html,
  });
  console.log('📧 Resend reminder result:', JSON.stringify(r1));
  if (r1.error) throw new Error(r1.error.message || JSON.stringify(r1.error));
}

module.exports = { sendWelcomeEmail, sendTradeReminder };
