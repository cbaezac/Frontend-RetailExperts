(function () {
  if (!window.RetailAPI || !window.RetailAPI.requireAuth()) return;

  var frame = document.querySelector('.frame-inner');
  if (!frame) return;

  var style = document.createElement('style');
  style.textContent = '.dashboard-live{position:absolute;inset:0;overflow:auto;padding:clamp(22px,3vw,36px);background:#fffbf5}.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.kpi-card{background:#fff;border:1px solid rgba(42,20,8,.12);border-radius:12px;padding:18px;box-shadow:0 10px 24px rgba(42,20,8,.08)}.kpi-label{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#776f66;font-weight:800}.kpi-value{margin-top:10px;font:800 clamp(1.8rem,3vw,2.8rem) Bricolage Grotesque,sans-serif;color:#1c1a14}.kpi-note{margin-top:8px;color:#776f66;font-size:13px}.dash-section{background:#fff;border:1px solid rgba(42,20,8,.12);border-radius:12px;padding:18px;margin-top:16px}.dash-section h2{font:800 1.2rem Bricolage Grotesque,sans-serif;margin-bottom:12px}.dash-table{width:100%;border-collapse:collapse;font-size:14px}.dash-table th,.dash-table td{padding:10px;border-bottom:1px solid rgba(42,20,8,.1);text-align:left}.dash-table th{color:#776f66;font-size:12px;text-transform:uppercase;letter-spacing:.1em}@media(max-width:900px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.kpi-grid{grid-template-columns:1fr}.dashboard-live{position:relative}}';
  document.head.appendChild(style);

  function number(value) {
    return new Intl.NumberFormat('es-CL').format(value || 0);
  }

  function money(value) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function kpi(label, value, note) {
    return '<div class="kpi-card"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + '</div><div class="kpi-note">' + note + '</div></div>';
  }

  frame.innerHTML = '<div class="dashboard-live">Cargando indicadores...</div>';
  window.RetailAPI.requestJson('/web/dashboard/resumen')
    .then(function (data) {
      frame.innerHTML = '<div class="dashboard-live">' +
        '<div class="kpi-grid">' +
          kpi('Fotos', number(data.fotos), 'Registros visuales disponibles') +
          kpi('Locales', number(data.locales_con_fotos), 'Puntos de venta con fotos') +
          kpi('Sesiones', number(data.sesiones_con_fotos), 'Ejecuciones con respaldo visual') +
          kpi('Productos', number(data.productos_gestionados), 'Productos gestionados') +
          kpi('Góndola', number(data.gondola), 'Fotos clasificadas como góndola') +
          kpi('Cartelería', number(data.carteleria), 'Fotos clasificadas como cartelería') +
          kpi('Exhibición adicional', number(data.exhibicion_adicional), 'Fotos de exhibiciones adicionales') +
          kpi('Venta 30 días', money(data.venta_ultimos_30_dias), 'Venta registrada en los últimos 30 días') +
        '</div>' +
      '</div>';
    })
    .catch(function () {
      frame.innerHTML = '<div class="placeholder"><h2>No se pudieron cargar los indicadores</h2><p>Revisa la sesion o la conexion con la API.</p></div>';
    });
})();
