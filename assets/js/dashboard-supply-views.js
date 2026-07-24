(function () {
  'use strict';

  var COLORS = ['#5A0D74', '#E0561C', '#1F8A4C', '#C2185B'];
  var CHAINS = ['Cencosud', 'Walmart', 'SMU', 'Tottus'];
  var PRODUCTS = ['Aceite vegetal 1L', 'Arroz grado 1 1kg', 'Atún lomitos 170g', 'Café instantáneo 170g', 'Detergente 3L', 'Papel higiénico 12u'];

  function hash(text) {
    var value = 2166136261;
    for (var i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function number(value) {
    return Math.round(value).toLocaleString('es-CL');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char];
    });
  }

  function installStyles() {
    if (document.getElementById('supplyViewsStyles')) return;
    var style = document.createElement('style');
    style.id = 'supplyViewsStyles';
    style.textContent =
      '.sv-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}' +
      '.sv-kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;text-align:center}' +
      '.sv-kpi b{display:block;font-family:var(--font-display);font-size:1.8rem;color:var(--purple);margin-top:6px}' +
      '.sv-kpi span{font-size:.78rem;color:var(--muted);font-weight:700}' +
      '.sv-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}' +
      '.sv-table th,.sv-table td{text-align:center!important}.sv-table td:first-child,.sv-table th:first-child{text-align:left!important}' +
      '.sv-status{display:inline-block;border-radius:999px;padding:4px 10px;font-size:.72rem;font-weight:700}' +
      '.sv-ok{background:rgba(31,138,76,.12);color:#1F8A4C}.sv-bad{background:rgba(192,57,43,.1);color:#C0392B}' +
      '.sv-download{border:0;border-radius:999px;background:var(--purple);color:#fff;padding:9px 15px;font:700 .8rem var(--font-display);cursor:pointer}' +
      '@media(max-width:850px){.sv-kpis,.sv-grid{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(style);
  }

  function installTabs() {
    // El rediseño ya trae los botones "Próximos Quiebres" y "Entregable CPFR"
    // en el grupo Supply, pero bloqueados (.tab-locked, sin data-area). Aquí los
    // desbloqueamos y les asignamos su área demo, sin crear duplicados.
    var AREAS = {'Próximos Quiebres': 'proxq', 'Entregable CPFR': 'cpfr'};
    [].slice.call(document.querySelectorAll('.tab.tab-locked')).forEach(function (btn) {
      var label = (btn.textContent || '').replace('Servicio no contratado', '').trim();
      var area = AREAS[label];
      if (!area || btn.getAttribute('data-area')) return;
      var tip = btn.querySelector('.lock-tip');
      if (tip) tip.parentNode.removeChild(tip);
      btn.classList.remove('tab-locked');
      btn.setAttribute('data-area', area);
      btn.textContent = label;
    });
  }

  function projectedRows() {
    return CHAINS.map(function (chain, index) {
      var seed = hash(chain);
      var stock = 7200 + seed % 9800;
      return {
        chain: chain,
        stock: stock,
        transit: 900 + (seed >>> 4) % 2800,
        cd: 1300 + (seed >>> 8) % 3600,
        instock: 62 + (seed % 280) / 10,
        color: COLORS[index]
      };
    });
  }

  function renderProjected() {
    var rows = projectedRows();
    var body = rows.map(function (row) {
      return '<tr><td><span class="cell-chain"><span class="cell-dot" style="background:' + row.color + '"></span>' + escapeHtml(row.chain) +
        '</span></td><td>' + number(row.stock) + '</td><td>' + number(row.transit) + '</td><td>' + number(row.cd) +
        '</td><td class="' + (row.instock >= 80 ? 'pos' : row.instock >= 70 ? 'amber' : 'neg') + '">' + row.instock.toFixed(1) + '%</td></tr>';
    }).join('');
    host.innerHTML =
      '<div class="panel-card full"><div class="pc-head"><div><div class="pc-title">Matriz de datos · Próximos Quiebres</div>' +
      '<div class="pc-sub">Proyección demo independiente · horizonte de 3 días</div></div></div>' +
      '<div class="table-scroll"><table class="matrix sv-table"><thead><tr><th>Cadena</th><th>Stock</th><th>Stock en tránsito</th><th>Stock en CD</th><th>Instock</th></tr></thead><tbody>' +
      body + '</tbody></table></div></div>' +
      '<div class="panel-card full"><div class="pc-head"><div><div class="pc-title">Evolución de stock e instock</div><div class="pc-sub">Datos demostrativos sin conexión a filtros ni servicios</div></div></div><div class="chart-box h-line"><canvas id="svProjectedChart"></canvas></div></div>';
    var labels = ['Hoy', '+1 día', '+2 días', '+3 días'];
    var chart = new Chart(document.getElementById('svProjectedChart'), {
      data: {labels: labels, datasets: [
        {type: 'bar', label: 'Stock', data: labels.map(function (_, i) { return rows.reduce(function (sum, row) { return sum + Math.round(row.stock * (1 - i * .11)); }, 0); }), backgroundColor: COLORS[0], borderRadius: 4},
        {type: 'line', label: 'Instock', data: labels.map(function (_, i) { return 82.5 - i * 4.8; }), borderColor: COLORS[3], yAxisID: 'y2', tension: 0, pointRadius: 4}
      ]},
      options: {responsive: true, maintainAspectRatio: false, scales: {x: {grid: {display: false}}, y: {grid: {color: 'rgba(42,20,8,.07)'}}, y2: {position: 'right', min: 0, max: 100, grid: {display: false}, ticks: {callback: function (v) { return v + '%'; }}}}}
    });
    charts.push(chart);
  }

  /* ---------- Entregable CPFR: conectado a /web/dashboard/cpfr/detalle ----------
     Regla de negocio (confirmada 2026-07-23): el usuario solo ve 3 estados —
     Abierto (recien detectado, dias_abierto=0), Persiste (sigue abierto, mas de
     dia 0), Resuelto. REINCIDENTE nunca aparece como categoria propia: se
     fusiona con Abierto/Persiste segun sus dias, igual que ABIERTO.
     El endpoint agregado /web/dashboard/cpfr (KPIs+pie+barras) NO sirve para
     esto -- agrupa por cc.estado crudo (3 buckets: ABIERTO/RESUELTO/
     REINCIDENTE), sin nocion de dias_abierto, asi que no puede separar
     Abierto de Persiste. Por eso NO se usa ese endpoint aca: se trae TODO el
     detalle de casos via /detalle (limit alto, sin paginar en la UI) y KPIs+
     pie+barras+el filtro Estado(caso) se calculan enteramente en este archivo
     a partir de esas filas. Pendiente aparte (fuera de esta tarea, otro repo):
     cpfrEstatusLabel() en analytics-platform/backend todavia devuelve
     "Reincidente" literal en el campo estatus de /detalle -- no se usa ese
     campo aca, se recalcula el propio (cpfrDisplayEstatus) a partir de
     estado+duracion crudos, que si vienen correctos. */
  var CPFR_ESTADOS = ['abierto', 'persiste', 'resuelto'];
  var CPFR_ESTADO_LABEL = {abierto: 'Abierto', persiste: 'Persiste', resuelto: 'Resuelto'};
  var cpfrEstadoSel = {abierto: true, persiste: true, resuelto: true}; // todos on = sin filtro
  var cpfrData = null; // cache: array de casos crudos (r.casos de /detalle)
  var cpfrError = false;

  function cpfrDisplayEstatus(row) {
    if (row.estado === 'RESUELTO') return 'Resuelto';
    return (Number(row.duracion) || 0) > 0 ? 'Persiste' : 'Abierto';
  }

  function cpfrEstadoKey(label) {
    if (label === 'Resuelto') return 'resuelto';
    if (label === 'Persiste') return 'persiste';
    return 'abierto';
  }

  function loadCpfr() {
    if (!window.RetailAPI) { cpfrError = true; return Promise.resolve(); }
    var de = document.getElementById('f-desde'), ha = document.getElementById('f-hasta');
    var params = withCliente(Object.assign(
      {limit: 5000, desde: de && de.value, hasta: ha && ha.value},
      fbFilterParams()
    ));
    // "estado" de la barra global es producto.estado; no aplica a este endpoint
    // (interpretaria cc.estado). El estado del caso se filtra client-side abajo.
    delete params.estado;
    return window.RetailAPI.requestJson('/web/dashboard/cpfr/detalle' + window.RetailAPI.buildQuery(params))
      .then(function (r) {
        cpfrData = (r && r.casos) || [];
        cpfrError = false;
      })
      .catch(function () {
        cpfrData = null;
        cpfrError = true;
      });
  }

  // Hook minimo expuesto para dashboards.html (mismo patron que
  // window.__mapaInvalidate) -- invalidado por "Aplicar filtros" cuando
  // area==='cpfr'. No dispara el fetch por si solo; el proximo renderCpfr()
  // ve cpfrData==null y lo hace.
  window.__cpfrInvalidate = function () {
    cpfrData = null;
    cpfrError = false;
  };

  function cpfrFilteredRows() {
    if (!cpfrData) return [];
    return cpfrData.filter(function (row) {
      return cpfrEstadoSel[cpfrEstadoKey(cpfrDisplayEstatus(row))];
    });
  }

  // Shape esperado por downloadCpfr() (sin tocar esa funcion):
  // date/chain/local/sku/product/problem/days/solved.
  function cpfrMappedRows(rows) {
    return rows.map(function (row) {
      return {
        date: row.fecha, chain: row.cadena, local: row.local || '-', sku: row.codigo_producto,
        product: row.producto || '-', problem: row.problema, days: row.duracion,
        solved: row.estado === 'RESUELTO', estatusLabel: cpfrDisplayEstatus(row)
      };
    });
  }

  function cpfrErrorCard() {
    host.innerHTML =
      '<div class="panel-card full" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:70px 24px;text-align:center">' +
      '<svg viewBox="0 0 24 24" fill="none" style="width:44px;height:44px;color:var(--purple)"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      '<div style="font-family:var(--font-display);font-weight:800;font-size:1.15rem;color:var(--ink)">No se pudo cargar la información</div>' +
      '<div style="font-size:.9rem;color:var(--muted);max-width:420px">Intentá de nuevo en unos segundos.</div>' +
      '<button type="button" class="sv-download" id="svCpfrRetry">Reintentar</button></div>';
    var btn = document.getElementById('svCpfrRetry');
    if (btn) btn.addEventListener('click', function () { window.__cpfrInvalidate(); renderCpfr(); });
  }

  // Control "Estado (caso)": expuesto via 2 hooks minimos que dashboards.html
  // invoca desde buildAreaControls/wireAreaControls, scoped a area==='cpfr'
  // (mismo patron que window.__renderMapa/__mapaInvalidate para Mapa).
  // Aplica al toque (sin esperar "Aplicar filtros"): no dispara fetch nuevo,
  // solo refiltra cpfrData ya cacheado.
  window.__cpfrAreaControls = function () {
    var buttons = CPFR_ESTADOS.map(function (key) {
      return '<button type="button" data-estado="' + key + '" class="' + (cpfrEstadoSel[key] ? 'on' : '') + '">' + CPFR_ESTADO_LABEL[key] + '</button>';
    }).join('');
    return '<div class="ctl-group"><label>Estado (caso)</label><div class="seg" id="cpfrEstadoSeg">' + buttons + '</div></div>';
  };

  window.__cpfrWireControls = function () {
    var seg = document.getElementById('cpfrEstadoSeg');
    if (!seg) return;
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var key = b.getAttribute('data-estado');
      cpfrEstadoSel[key] = !cpfrEstadoSel[key];
      b.classList.toggle('on', cpfrEstadoSel[key]);
      renderCpfr();
    });
  };

  function downloadCpfr(rows) {
    var csv = [['Fecha', 'Cadena', 'Local', 'Código Producto', 'Producto', 'Problema', 'Duración', 'Estatus']].concat(rows.map(function (row) {
      return [row.date, row.chain, row.local, row.sku, row.product, row.problem, row.days, row.solved ? 'Resuelto' : 'Persiste'];
    })).map(function (row) {
      return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8'}));
    link.download = 'Reporte_CPFR_demo.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function renderCpfr() {
    if (cpfrError) { cpfrErrorCard(); return; }
    if (!cpfrData) {
      host.innerHTML = LOADER_CARD;
      loadCpfr().then(renderCpfr).catch(function () {});
      return;
    }
    var mapped = cpfrMappedRows(cpfrFilteredRows());
    var solved = mapped.filter(function (row) { return row.solved; }).length;
    var total = mapped.length;
    var body = mapped.map(function (row) {
      return '<tr><td>' + row.date + '</td><td>' + escapeHtml(row.chain) + '</td><td>' + escapeHtml(row.local) + '</td><td>' + row.sku +
        '</td><td>' + escapeHtml(row.product) + '</td><td>' + escapeHtml(row.problem) + '</td><td>' + row.days +
        '</td><td><span class="sv-status ' + (row.solved ? 'sv-ok' : 'sv-bad') + '">' + row.estatusLabel + '</span></td></tr>';
    }).join('');
    host.innerHTML =
      '<div class="sv-kpis"><div class="sv-kpi"><span>Casos totales</span><b>' + total + '</b></div><div class="sv-kpi"><span>Casos resueltos</span><b>' + solved +
      '</b></div><div class="sv-kpi"><span>Casos persisten</span><b>' + (total - solved) + '</b></div><div class="sv-kpi"><span>% Casos resueltos</span><b>' +
      (total ? Math.round(solved / total * 100) : 0) + '%</b></div></div>' +
      '<div class="sv-grid"><div class="panel-card"><div class="pc-head"><div><div class="pc-title">Estatus de casos</div><div class="pc-sub">Datos reales</div></div></div><div class="chart-box h-mid"><canvas id="svCpfrPie"></canvas></div></div>' +
      '<div class="panel-card"><div class="pc-head"><div><div class="pc-title">Casos por cadena</div><div class="pc-sub">Distribución real</div></div></div><div class="chart-box h-mid"><canvas id="svCpfrBar"></canvas></div></div></div>' +
      '<div class="panel-card full"><div class="pc-head"><div><div class="pc-title">Detalle de casos · Local / Producto</div><div class="pc-sub">Conectado a filtros</div></div><button class="sv-download" id="svCpfrDownload" type="button">Descargar CSV</button></div>' +
      '<div class="table-scroll"><table class="matrix sv-table"><thead><tr><th>Fecha</th><th>Cadena</th><th>Local</th><th>Cod Producto</th><th>Producto</th><th>Problema</th><th>Duración</th><th>Estatus</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
    var pieCounts = {Abierto: 0, Persiste: 0, Resuelto: 0};
    mapped.forEach(function (row) { pieCounts[row.estatusLabel] = (pieCounts[row.estatusLabel] || 0) + 1; });
    var pie = new Chart(document.getElementById('svCpfrPie'), {type: 'doughnut', data: {labels: ['Abierto', 'Persiste', 'Resuelto'], datasets: [{data: [pieCounts.Abierto, pieCounts.Persiste, pieCounts.Resuelto], backgroundColor: ['#F3D47A', '#E8918C', '#7FC99A'], borderColor: '#fff'}]}, options: {responsive: true, maintainAspectRatio: false}});
    var chainCounts = {};
    mapped.forEach(function (row) { chainCounts[row.chain] = (chainCounts[row.chain] || 0) + 1; });
    var chainLabels = Object.keys(chainCounts);
    var bar = new Chart(document.getElementById('svCpfrBar'), {type: 'bar', data: {labels: chainLabels, datasets: [{data: chainLabels.map(function (c) { return chainCounts[c]; }), backgroundColor: COLORS, borderRadius: 5}]}, options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {x: {grid: {display: false}}}}});
    charts.push(pie, bar);
    document.getElementById('svCpfrDownload').addEventListener('click', function () { downloadCpfr(mapped); });
  }

  installStyles();
  installTabs();
  if (window.RENDER) {
    window.RENDER.proxq = renderProjected;
    window.RENDER.cpfr = renderCpfr;
  }
  if (window.AREA_LOG) {
    window.AREA_LOG.proxq = 'Próximos Quiebres';
    window.AREA_LOG.cpfr = 'Entregable CPFR';
  }
}());
