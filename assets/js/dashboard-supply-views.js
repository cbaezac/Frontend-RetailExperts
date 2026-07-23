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

  function cpfrRows() {
    var rows = [];
    for (var i = 0; i < 24; i++) {
      var chain = CHAINS[i % CHAINS.length];
      var product = PRODUCTS[i % PRODUCTS.length];
      var seed = hash(chain + product + i);
      rows.push({
        date: ('0' + (1 + seed % 27)).slice(-2) + '-07-2026',
        chain: chain,
        local: 'Local ' + (101 + seed % 80),
        sku: 'SKU' + (1001 + seed % 90),
        product: product,
        problem: ['Quiebre', 'Próximo quiebre 1d', 'Próximo quiebre 3d', 'Próximo quiebre 5d'][seed % 4],
        days: 1 + seed % 9,
        solved: seed % 100 < 62
      });
    }
    return rows;
  }

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
    var rows = cpfrRows();
    var solved = rows.filter(function (row) { return row.solved; }).length;
    var body = rows.map(function (row) {
      return '<tr><td>' + row.date + '</td><td>' + escapeHtml(row.chain) + '</td><td>' + escapeHtml(row.local) + '</td><td>' + row.sku +
        '</td><td>' + escapeHtml(row.product) + '</td><td>' + escapeHtml(row.problem) + '</td><td>' + row.days +
        '</td><td><span class="sv-status ' + (row.solved ? 'sv-ok' : 'sv-bad') + '">' + (row.solved ? 'Resuelto' : 'Persiste') + '</span></td></tr>';
    }).join('');
    host.innerHTML =
      '<div class="sv-kpis"><div class="sv-kpi"><span>Casos totales</span><b>' + rows.length + '</b></div><div class="sv-kpi"><span>Casos resueltos</span><b>' + solved +
      '</b></div><div class="sv-kpi"><span>Casos persisten</span><b>' + (rows.length - solved) + '</b></div><div class="sv-kpi"><span>% Casos resueltos</span><b>' +
      Math.round(solved / rows.length * 100) + '%</b></div></div>' +
      '<div class="sv-grid"><div class="panel-card"><div class="pc-head"><div><div class="pc-title">Estatus de casos</div><div class="pc-sub">Datos demo independientes</div></div></div><div class="chart-box h-mid"><canvas id="svCpfrPie"></canvas></div></div>' +
      '<div class="panel-card"><div class="pc-head"><div><div class="pc-title">Casos por cadena</div><div class="pc-sub">Distribución demostrativa</div></div></div><div class="chart-box h-mid"><canvas id="svCpfrBar"></canvas></div></div></div>' +
      '<div class="panel-card full"><div class="pc-head"><div><div class="pc-title">Detalle de casos · Local / Producto</div><div class="pc-sub">Sin conexión a filtros ni servicios</div></div><button class="sv-download" id="svCpfrDownload" type="button">Descargar CSV</button></div>' +
      '<div class="table-scroll"><table class="matrix sv-table"><thead><tr><th>Fecha</th><th>Cadena</th><th>Local</th><th>Cod Producto</th><th>Producto</th><th>Problema</th><th>Duración</th><th>Estatus</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
    var pie = new Chart(document.getElementById('svCpfrPie'), {type: 'doughnut', data: {labels: ['Resuelto', 'Persiste'], datasets: [{data: [solved, rows.length - solved], backgroundColor: ['#7FC99A', '#E8918C'], borderColor: '#fff'}]}, options: {responsive: true, maintainAspectRatio: false}});
    var perChain = CHAINS.map(function (chain) { return rows.filter(function (row) { return row.chain === chain; }).length; });
    var bar = new Chart(document.getElementById('svCpfrBar'), {type: 'bar', data: {labels: CHAINS, datasets: [{data: perChain, backgroundColor: COLORS, borderRadius: 5}]}, options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {display: false}}, scales: {x: {grid: {display: false}}}}});
    charts.push(pie, bar);
    document.getElementById('svCpfrDownload').addEventListener('click', function () { downloadCpfr(rows); });
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
