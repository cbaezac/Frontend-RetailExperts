/* Asistencia real desde el backend (tabla asistencia_diaria vía vista asistencia).
   Construye window.ASISTENCIA con la misma forma que esperaban las páginas:
   - dates: ['YYYY-MM-DD', ...] ascendente
   - clients / clientLabels: nombres de cliente y su etiqueta visible
   - locales: [cadena, codigoLocal, nombre, ruta]
   - rows: [dateIdx, localIdx, clientIdx, plan, real, ajustada, rut, diasVisita]
     (agregado por visita: si hay varios reponedores en un local,
      plan/real = máximo entre ellos; rut = el del reponedor de la fila)
   Al terminar marca ASISTENCIA.ready = true y dispara 'asistencia:ready'.
   Requiere sesión web con acceso admin; si no la hay, queda vacío (los
   descargadores de clientes se conectarán con su propio endpoint con scoping). */
window.ASISTENCIA = { dates: [], clients: [], clientLabels: [], locales: [], rows: [], ready: false };
(function () {
  var API = window.RetailAPI;

  function done() {
    window.ASISTENCIA.ready = true;
    document.dispatchEvent(new CustomEvent('asistencia:ready'));
  }

  if (!API || !API.getToken()) { done(); return; }

  var tbody = document.getElementById('tbody');
  if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="13">Cargando asistencia…</td></tr>';

  var LIMIT = 1000, MAX_PAGES = 30;
  var filas = [];

  function fetchPage(page) {
    return API.requestJson('/web/admin/asignaciones/asistencia/listado' + API.buildQuery({ limit: LIMIT, page: page }))
      .then(function (r) {
        filas = filas.concat(r.asistencia || []);
        if (filas.length < Number(r.total || 0) && page < MAX_PAGES) return fetchPage(page + 1);
      });
  }

  fetchPage(1).then(function () {
    var dateSet = {}, cliSet = {}, locIdx = {}, locales = [];
    filas.forEach(function (f) {
      dateSet[String(f.fecha).slice(0, 10)] = true;
      cliSet[f.cliente] = true;
    });
    var dates = Object.keys(dateSet).sort();
    var clients = Object.keys(cliSet).sort(function (a, b) { return a.localeCompare(b, 'es'); });
    var dateIdx = {}, cliIdx = {};
    dates.forEach(function (d, i) { dateIdx[d] = i; });
    clients.forEach(function (c, i) { cliIdx[c] = i; });

    var agg = {};
    filas.forEach(function (f) {
      var lKey = f.codigo_local + '|' + (f.ruta || '');
      if (!(lKey in locIdx)) {
        locIdx[lKey] = locales.length;
        locales.push([f.cadena || '', f.codigo_local, f.nombre_local || f.codigo_local, f.ruta || '']);
      }
      var key = dateIdx[String(f.fecha).slice(0, 10)] + ':' + locIdx[lKey] + ':' + cliIdx[f.cliente];
      var cur = agg[key] || { plan: 0, real: 0, aj: 0, rut: f.rut, dias: f.dias_visita };
      cur.plan = Math.max(cur.plan, Number(f.planificado) || 0);
      cur.real = Math.max(cur.real, Number(f.asistido) || 0);
      if (f.ajustada) cur.aj = 1;
      if (f.dias_visita) cur.dias = f.dias_visita;
      agg[key] = cur;
    });

    var rows = Object.keys(agg).map(function (key) {
      var p = key.split(':');
      return [Number(p[0]), Number(p[1]), Number(p[2]), agg[key].plan, agg[key].real, agg[key].aj, agg[key].rut, agg[key].dias || ''];
    });

    window.ASISTENCIA.dates = dates;
    window.ASISTENCIA.clients = clients;
    window.ASISTENCIA.clientLabels = clients.map(function (c) {
      return String(c).replace(/\w\S*/g, function (t) { return t.charAt(0).toUpperCase() + t.substr(1); });
    });
    window.ASISTENCIA.locales = locales;
    window.ASISTENCIA.rows = rows;
    done();
  }).catch(function () {
    // Sin acceso al endpoint (p. ej. usuario cliente): se muestra vacío.
    done();
  });
})();
