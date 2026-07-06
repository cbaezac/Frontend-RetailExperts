/*
  Overlay "Servicio no disponible" · Retail Experts
  Uso: incluir al final del <body> de la página del módulo:
    <script src="assets/js/modulo-no-contratado.js"></script>

  ACTIVACIÓN POR CLIENTE (Caso B — sitio compartido):
  El script lee el usuario guardado en sesión (localStorage 'retailexperts_web_user',
  el mismo objeto `user` que devuelve tu backend en el login) y busca el campo:
      dashboards_contratado: true   -> NO muestra el pop-up (cliente pagó)
      dashboards_contratado: false | ausente -> SÍ muestra el pop-up
  Es decir: tu backend solo debe agregar ese campo booleano al objeto user
  del login según el plan de cada cliente. Nada más.
*/
(function () {
  // INTERRUPTOR GENERAL: mientras el backend no envíe `dashboards_contratado`
  // en el login, el pop-up queda desactivado para todos. Para activarlo,
  // cambiar a true (y el backend decide por cliente con ese campo).
  var POPUP_PAGO_ACTIVO = true;
  if (!POPUP_PAGO_ACTIVO) return;

  // ¿El cliente tiene contratado este módulo? -> no mostrar nada.
  try {
    var user = JSON.parse(window.localStorage.getItem('retailexperts_web_user') || 'null');
    if (user && user.dashboards_contratado === true) return;
  } catch (_) { /* si no se puede leer la sesión, se muestra el aviso */ }

  var style = document.createElement('style');
  style.textContent = [
    '.mnc-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;',
    'background:rgba(36,16,38,.55);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);}',
    '.mnc-card{position:relative;width:min(432px,100%);background:#FFF8E7;border:2px solid #2A1408;border-radius:18px;',
    'box-shadow:0 30px 80px rgba(36,16,38,.45);padding:34px 32px 30px;text-align:center;',
    'font-family:Manrope,sans-serif;color:#241026;animation:mncIn .35s cubic-bezier(.2,.9,.3,1.2);}',
    '@keyframes mncIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}',
    '.mnc-card::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;border-radius:16px 16px 0 0;',
    'background:linear-gradient(90deg,#5A0D74 0%,#9B2D9E 45%,#FF5A1F 100%);}',
    '.mnc-ico{width:58px;height:58px;margin:0 auto 16px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
    'background:rgba(255,90,31,.12);border:1.5px dashed rgba(255,90,31,.45);color:#FF5A1F;}',
    '.mnc-ico svg{width:30px;height:30px;}',
    '.mnc-badge{display:inline-flex;align-items:center;gap:7px;font-family:"Bricolage Grotesque",sans-serif;font-weight:700;',
    'font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;color:#5A0D74;background:rgba(90,13,116,.10);',
    'border:1px solid rgba(90,13,116,.25);border-radius:999px;padding:6px 14px;margin-bottom:14px;}',
    '.mnc-title{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:1.55rem;letter-spacing:-.01em;margin-bottom:12px;}',
    '.mnc-text{font-size:.95rem;line-height:1.65;color:#6E6275;margin-bottom:16px;}',
    '.mnc-text strong{color:#241026;}',
    '.mnc-hint{font-size:.85rem;line-height:1.6;color:#6E6275;margin-bottom:18px;}',
    '.mnc-btn{display:inline-flex;align-items:center;gap:9px;font-family:"Bricolage Grotesque",sans-serif;font-weight:700;',
    'font-size:.95rem;color:#fff;background:#FF5A1F;border:none;border-radius:999px;padding:13px 30px;cursor:pointer;',
    'text-decoration:none;box-shadow:0 14px 30px rgba(255,90,31,.35);transition:transform .2s,box-shadow .2s;}',
    '.mnc-btn:hover{transform:translateY(-2px);box-shadow:0 18px 36px rgba(255,90,31,.42);}',
    '.mnc-btn svg{width:17px;height:17px;}',
    '.mnc-back{display:inline-flex;align-items:center;gap:7px;margin-top:2px;font-family:Manrope,sans-serif;font-weight:600;',
    'font-size:.85rem;color:#6E6275;background:transparent;border:none;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}',
    '.mnc-back:hover{color:#241026;}',
    'body.mnc-lock{overflow:hidden;}'
  ].join('');
  document.head.appendChild(style);

  var ov = document.createElement('div');
  ov.className = 'mnc-ov';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.innerHTML =
    '<div class="mnc-card">' +
      '<div class="mnc-ico">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="4" y="11" width="16" height="9" rx="2"></rect>' +
          '<path d="M8 11V7a4 4 0 0 1 8 0v4"></path>' +
        '</svg>' +
      '</div>' +
      '<div class="mnc-badge">Servicio no disponible</div>' +
      '<p class="mnc-text">Este módulo <strong>no forma parte de tu plan contratado</strong>.</p>' +
      '<p class="mnc-hint">Contacta al equipo comercial de <strong>RetailExperts</strong> para solicitar un período de prueba gratuito, y cotizar la inclusión de este servicio.</p>' +
      '<button class="mnc-back" type="button" onclick="history.back()">Volver a la página anterior</button>' +
    '</div>';

  function mount() {
    document.body.appendChild(ov);
    document.body.classList.add('mnc-lock');
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
