(function () {
  'use strict';

  // Vistas Supply:
  //   · Próximos Quiebres -> window.RENDER.proxq = panelProxQuiebres  (rediseño, datos DEMO)
  //   · Entregable CPFR    -> window.RENDER.cpfr  = renderCpfr         (rediseño + datos REALES
  //                                                                     /web/dashboard/cpfr/detalle)
  // Reutiliza helpers globales del script principal de dashboards.html: abaLocals, kpiCard,
  // pieChart, smThead/smSortRows/smWire, wireDrillMenu, drillChildren/drillName/drillCueHtml/
  // drillBackHtml, chartColor, num, numShort, pct, clsIns, IC, APERTURAS, COM, DEFAULT_PERIODS,
  // LOADER_CARD, withCliente, fbFilterParams, host, charts, Chart, window.RetailAPI.

  // Ícono de descarga (IC.download no existe en esta versión) — hereda color/tamaño del contenedor.
  var DL_ICON = '<svg viewBox="0 0 24 24" fill="none" style="width:100%;height:100%"><path d="M12 3v11m0 0l-4-4m4 4l4-4M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function isoOfLocal(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char];
    });
  }

  function installStyles() {
    if (document.getElementById('supplyViewsStyles')) return;
    var style = document.createElement('style');
    style.id = 'supplyViewsStyles';
    style.textContent =
      'table#cpfrTable thead th, table#cpfrTable tbody td, #cpfrMatrix table.matrix thead th:first-child, #cpfrMatrix table.matrix tbody td:first-child{ text-align:center; }' +
      '#cpfrMatrix table.matrix thead th, #cpfrMatrix table.matrix tbody td{ padding:7px 5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
      '#cpfrMatrix table.matrix thead th{ font-size:.6rem; letter-spacing:0; white-space:normal; line-height:1.15; overflow:visible; text-overflow:clip; word-break:break-word; }' +
      '#cpfrMatrix .table-scroll{ overflow-x:hidden; }' +
      '#cpfrKpis .kpi .k-top{ justify-content:center; }' +
      '#cpfrKpis .kpi .k-main{ justify-content:center; }' +
      '#cpfrKpis .kpi .k-label{ text-align:center; }' +
      '#cpfrKpis .kpi .k-value{ font-size:2.1rem !important; }' +
      'table#cpfrTable thead th:not(:first-child), table#cpfrTable tbody td:not(:first-child){ min-width:0; }';
    document.head.appendChild(style);
  }

  function installTabs() {
    // El rediseño trae los botones "Próximos Quiebres" y "Entregable CPFR" en el
    // grupo Supply, pero bloqueados (.tab-locked, sin data-area). Aquí los
    // desbloqueamos y les asignamos su área, sin crear duplicados.
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

  /* ---- Próximos Quiebres (rediseño · datos DEMO, sin conexión a servicios) ---- */
  var pqApertura = 'cadena', pqSort = {key: 'ins', dir: 1}, pqHorizon = 3, pqDrill = [];
  var pqPeriod = {start: DEFAULT_PERIODS.yesterday.start, end: DEFAULT_PERIODS.yesterday.end};
  function pqCurPeriod() {
    var de = document.getElementById('f-desde'), ha = document.getElementById('f-hasta');
    var s = (de && de.value) || pqPeriod.start, e = (ha && ha.value) || pqPeriod.end;
    if (e < s) e = s; pqPeriod = {start: s, end: e}; return pqPeriod;
  }
  function pqDays() {
    var p = pqCurPeriod();
    var days = Math.round((new Date(p.end) - new Date(p.start)) / 86400000) + 1;
    days = Math.max(1, Math.min(45, days));
    var out = [], base = new Date(p.end);
    for (var i = days - 1; i >= 0; i--) { out.push(new Date(base.getTime() - i * 86400000)); }
    return out;
  }
  function pqApLabel() { return APERTURAS.filter(function (a) { return a[0] === pqApertura; })[0][1]; }
  function pqKeyFor(l) {
    if (pqApertura === 'cadena') return l.cad;
    if (pqApertura === 'formato') return l.fmt;
    if (pqApertura === 'codlocal') return l.cod;
    if (pqApertura === 'nomlocal') return l.cod + ' · ' + l.nom;
    var vs = COM.aperturas[pqApertura].values;
    return vs[hashN(l.cod + ':' + pqApertura) % vs.length].label;
  }
  function panelProxQuiebres() {
    var pqNeedsCom = ['cadena', 'formato', 'codlocal', 'nomlocal'].indexOf(pqApertura) < 0 ? pqApertura : null;
    if (needsData('proxq', pqNeedsCom, panelProxQuiebres)) return;
    renderPqMatrix();
  }
  function pqLevelRows() {
    var level = pqDrill.length;
    if (level === 0) {
      var L = abaLocals(), by = {};
      L.forEach(function (l) { var k = pqKeyFor(l); if (!by[k]) by[k] = {stock: 0, tra: 0, cd: 0, insW: 0, w: 0}; by[k].stock += l.stock; by[k].tra += l.transito; by[k].cd += l.cd; by[k].insW += l.ins * l.stock; by[k].w += l.stock; });
      return Object.keys(by).map(function (k) { var o = by[k]; var base = o.w ? o.insW / o.w : 0; var ins = Math.max(38, Math.min(100, base - (pqHorizon - 1) * 2.4 + (hashN('pqh:' + k + pqHorizon) % 18) / 10)); return {key: k, label: k, stock: o.stock, tra: o.tra, cd: o.cd, ins: ins, drill: true}; });
    }
    var last = pqDrill[level - 1];
    var seed = pqDrill.map(function (p) { return p.label; }).join('>');
    var terminal = (last.ap === 'producto' || last.ap === 'codprod');
    return drillChildren(last.ap, seed).map(function (o) {
      var ins = Math.max(38, Math.min(100, last.row.ins + ((o.h % 800) / 100 - 4)));
      return {key: o.cod || o.label, label: o.label, cod: o.cod, rawLabel: o.label, stock: Math.round(last.row.stock * o.frac), tra: Math.round(last.row.tra * o.frac), cd: Math.round(last.row.cd * o.frac), ins: ins, drill: !terminal};
    });
  }
  function renderPqMatrix() {
    var level = pqDrill.length;
    var curAp = level ? pqDrill[level - 1].ap : pqApertura;
    var usedAps = [pqApertura].concat(pqDrill.map(function (p) { return p.ap; }));
    var rows = pqLevelRows();
    var byKey = {}; rows.forEach(function (r) { byKey[r.key] = r; });
    var sub, back = '';
    if (level === 0) { sub = 'Por ' + drillName(curAp).toLowerCase() + ' · instock proyectado a ' + pqHorizon + ' día' + (pqHorizon === 1 ? '' : 's') + ' · abre otra apertura con la flecha'; }
    else { sub = pqDrill[level - 1].label + ' · apertura por ' + drillName(curAp).toLowerCase(); back = drillBackHtml('pqBack', level > 1 ? pqDrill[level - 2].ap : pqApertura); }
    var cols = [
      {key: 'label', label: drillName(curAp), type: 'text', thLeft: true, get: function (r) { return r.label; }, cell: function (r, ri) { return '<td><span class="cell-chain"><span class="cell-dot" style="background:' + chartColor(ri) + '"></span>' + r.label + '</span>' + (r.drill ? drillCueHtml(r.key) : '') + '</td>'; }},
      {key: 'stock', label: 'Stock', type: 'num', get: function (r) { return r.stock; }, cell: function (r) { return '<td>' + num(r.stock) + '</td>'; }},
      {key: 'tra', label: 'Stock en tránsito', type: 'num', get: function (r) { return r.tra; }, cell: function (r) { return '<td>' + num(r.tra) + '</td>'; }},
      {key: 'cd', label: 'Stock en CD', type: 'num', get: function (r) { return r.cd; }, cell: function (r) { return '<td>' + num(r.cd) + '</td>'; }},
      {key: 'ins', label: 'Instock', type: 'num', get: function (r) { return r.ins; }, cell: function (r) { return '<td class="' + clsIns(r.ins) + '">' + r.ins.toFixed(1) + '%</td>'; }}
    ];
    var sorted = smSortRows(cols, rows, pqSort);
    var body = sorted.map(function (r) { var ri = rows.indexOf(r); return '<tr' + (r.drill ? ' class="drillable"' : '') + '>' + cols.map(function (c) { return c.cell(r, ri); }).join('') + '</tr>'; }).join('');
    if (!rows.length) body = '<tr><td colspan="' + cols.length + '" style="text-align:center;color:var(--muted);padding:26px">Sin datos para esta apertura y período</td></tr>';
    var tS = 0, tT = 0, tC = 0, tIW = 0, tW = 0; rows.forEach(function (r) { tS += r.stock; tT += r.tra; tC += r.cd; tIW += r.ins * r.stock; tW += r.stock; });
    host.innerHTML = '<div class="panel-card full" id="pqMatrix"><div class="pc-head"><div><div class="pc-title">Matriz de datos · Próximos Quiebres</div><div class="pc-sub">' + sub + '</div></div>' + back + '</div>'
      + '<div class="table-scroll"><table class="matrix' + (level > 0 ? ' matrix-left' : '') + '" style="table-layout:fixed;width:100%"><colgroup><col style="width:28%"><col style="width:18%"><col style="width:18%"><col style="width:18%"><col style="width:18%"></colgroup><thead>' + smThead(cols, pqSort) + '</thead><tbody>' + body + '</tbody>'
      + (rows.length ? ('<tfoot><tr><td>Total</td><td>' + num(tS) + '</td><td>' + num(tT) + '</td><td>' + num(tC) + '</td><td class="' + clsIns(tW ? tIW / tW : 0) + '">' + (tW ? tIW / tW : 0).toFixed(1) + '%</td></tr></tfoot>') : '')
      + '</table></div></div>'
      + '<div class="panel-card full"><div class="pc-head"><div><div class="pc-title">Evolución de stock e instock</div><div class="pc-sub">Stock, tránsito y CD en barras · instock en línea · ' + pqDays().length + ' día' + (pqDays().length === 1 ? '' : 's') + '</div></div></div><div class="chart-box h-line"><canvas id="pq-evo"></canvas></div></div>';
    smWire('#pqMatrix', cols, pqSort, renderPqMatrix);
    var backEl = document.getElementById('pqBack'); if (backEl) { backEl.addEventListener('click', function () { pqDrill.pop(); renderPqMatrix(); }); }
    wireDrillMenu('#pqMatrix', byKey, curAp, usedAps, function (ap, row) { pqDrill.push({ap: ap, label: row.label, rawLabel: row.rawLabel || row.label, row: row}); renderPqMatrix(); });
    renderPqEvo(rows);
  }
  function renderPqEvo(rows) {
    var cv = document.getElementById('pq-evo'); if (!cv) return;
    var days = pqDays(), n = days.length;
    var labels = days.map(function (d) { return abaFmtDay(isoOfLocal(d)); });
    var tot = {stock: 0, tra: 0, cd: 0, insW: 0, w: 0}; rows.forEach(function (r) { tot.stock += r.stock; tot.tra += r.tra; tot.cd += r.cd; tot.insW += r.ins * r.stock; tot.w += r.stock; });
    var avgIns = tot.w ? tot.insW / tot.w : 0;
    function split(total, seed) { var w = [], sw = 0; for (var i = 0; i < n; i++) { var x = 0.8 + (hashN(seed + i) % 40) / 100; w.push(x); sw += x; } return w.map(function (x) { return Math.round(total * x / sw); }); }
    var dStock = split(tot.stock, 'pqs'), dTra = split(tot.tra, 'pqt'), dCd = split(tot.cd, 'pqc');
    var dIns = days.map(function (_, i) { return Math.max(38, Math.min(100, avgIns + ((hashN('pqi' + i) % 400) / 100 - 2))); });
    var ch = new Chart(cv, {data: {labels: labels, datasets: [
      {type: 'bar', label: 'Stock', data: dStock, backgroundColor: chartColor(0), stack: 's', yAxisID: 'y', maxBarThickness: 46, borderRadius: 3},
      {type: 'bar', label: 'Stock en tránsito', data: dTra, backgroundColor: chartColor(1), stack: 's', yAxisID: 'y', maxBarThickness: 46, borderRadius: 3},
      {type: 'bar', label: 'Stock en CD', data: dCd, backgroundColor: chartColor(2), stack: 's', yAxisID: 'y', maxBarThickness: 46, borderRadius: 3},
      {type: 'line', label: 'Instock', data: dIns, borderColor: '#C2185B', backgroundColor: 'transparent', tension: 0, borderWidth: 2.4, pointRadius: 3, pointHoverRadius: 5, yAxisID: 'y2'}
    ]},
      options: {responsive: true, maintainAspectRatio: false, interaction: {mode: 'index', intersect: false},
        plugins: {legend: {display: true, position: 'top', align: 'end', labels: {usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14, font: {weight: '600'}}},
          tooltip: {callbacks: {label: function (ctx) { return ctx.dataset.label + ': ' + (ctx.dataset.yAxisID === 'y2' ? ctx.parsed.y.toFixed(1) + '%' : num(ctx.parsed.y)); }}}},
        scales: {x: {grid: {display: false}, stacked: true}, y: {grid: {color: 'rgba(42,20,8,0.07)'}, stacked: true, ticks: {callback: function (v) { return numShort(v); }}}, y2: {position: 'right', min: 0, max: 100, grid: {display: false}, ticks: {callback: function (v) { return v + '%'; }}}}}});
    charts.push(ch);
  }

  /* ---- Entregable CPFR (rediseño + datos REALES /web/dashboard/cpfr/detalle) ----
     Regla de negocio (main, confirmada 2026-07-23): el usuario ve 3 estados —
     Abierto (recién detectado, duración 0), Persiste (sigue abierto, >0 días) y
     Resuelto. "Reincidente" del backend NO es categoría propia: el estatus se
     recalcula acá desde estado+duración crudos (cpfrDisplayEstatus); el campo
     `estatus` que trae /detalle no se usa. Todo (KPIs, torta, barras, filtro) se
     calcula en este archivo a partir de las filas crudas cacheadas en cpfrData. */
  var cpfrSort = {key: 'status', dir: 1}, cpfrStatusFilter = 'todos';
  var cpfrData = null;   // cache de casos crudos (r.casos de /detalle)
  var cpfrError = false;
  var CPFR_EST_COLOR = {Abierto: '#F3D47A', Persiste: '#E8918C', Resuelto: '#7FC99A'};

  function cpfrDisplayEstatus(row) {
    if (row.estado === 'RESUELTO') return 'Resuelto';
    return (Number(row.duracion) || 0) > 0 ? 'Persiste' : 'Abierto';
  }
  function cpfrFmtFecha(iso) { if (!iso) return ''; var p = String(iso).split('-'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : String(iso); }

  function loadCpfr() {
    if (!window.RetailAPI) { cpfrError = true; return Promise.resolve(); }
    var de = document.getElementById('f-desde'), ha = document.getElementById('f-hasta');
    var params = withCliente(Object.assign({limit: 5000, desde: de && de.value, hasta: ha && ha.value}, fbFilterParams()));
    // "estado" de la barra global es producto.estado; no aplica al estado del caso.
    delete params.estado;
    return window.RetailAPI.requestJson('/web/dashboard/cpfr/detalle' + window.RetailAPI.buildQuery(params))
      .then(function (r) { cpfrData = (r && r.casos) || []; cpfrError = false; })
      .catch(function () { cpfrData = null; cpfrError = true; });
  }
  // Invalidación al "Aplicar filtros" (dashboards.html, area==='cpfr'). No dispara
  // el fetch: el próximo renderCpfr() ve cpfrData==null y lo hace.
  window.__cpfrInvalidate = function () { cpfrData = null; cpfrError = false; };

  function cpfrErrorCard() {
    host.innerHTML =
      '<div class="panel-card full" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:70px 24px;text-align:center">' +
      '<svg viewBox="0 0 24 24" fill="none" style="width:44px;height:44px;color:var(--purple)"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      '<div style="font-family:var(--font-display);font-weight:800;font-size:1.15rem;color:var(--ink)">No se pudo cargar la información</div>' +
      '<div style="font-size:.9rem;color:var(--muted);max-width:420px">Intentá de nuevo en unos segundos.</div>' +
      '<button type="button" id="cpfrRetry" style="border:0;border-radius:999px;background:var(--purple);color:#fff;padding:9px 15px;font:700 .8rem var(--font-display);cursor:pointer">Reintentar</button></div>';
    var btn = document.getElementById('cpfrRetry');
    if (btn) btn.addEventListener('click', function () { window.__cpfrInvalidate(); renderCpfr(); });
  }

  function cpfrDownload() {
    if (!cpfrData) return;
    var head = ['Fecha', 'Cadena', 'Local', 'Cod Producto', 'Producto', 'Problema', 'Duración', 'Estatus'];
    var lines = [head].concat(cpfrData.map(function (r) {
      return [cpfrFmtFecha(r.fecha), r.cadena, r.local || '-', r.codigo_producto, r.producto || '-', r.problema, (Number(r.duracion) || 0), cpfrDisplayEstatus(r)];
    })).map(function (row) {
      return row.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines], {type: 'text/csv;charset=utf-8'}));
    a.download = 'Reporte_CPFR.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderCpfr() {
    if (cpfrError) { cpfrErrorCard(); return; }
    if (!cpfrData) {
      host.innerHTML = LOADER_CARD;
      loadCpfr().then(renderCpfr).catch(function () {});
      return;
    }
    var casos = cpfrData;
    var nTot = casos.length;
    var nRes = casos.filter(function (c) { return c.estado === 'RESUELTO'; }).length;
    var nPer = nTot - nRes;
    var ha = document.getElementById('f-hasta');
    var hasta = cpfrFmtFecha((ha && ha.value) || DEFAULT_PERIODS.yesterday.end);
    var html = '<div class="kpis" id="cpfrKpis" style="grid-template-columns:repeat(5,1fr)">'
      + kpiCard({label: 'Casos totales', value: num(nTot), valueColor: '#5A0D74', icon: IC.box, tone: 'purple'})
      + kpiCard({label: 'Casos resueltos', value: num(nRes), valueColor: '#1F8A4C', icon: IC.check, tone: 'green'})
      + kpiCard({label: 'Casos persisten', value: num(nPer), valueColor: '#C0392B', icon: IC.lost, tone: 'accent'})
      + kpiCard({label: '% Casos Resueltos', value: nTot ? pct(nRes / nTot * 100) : '-', valueColor: nTot && nRes / nTot >= 0.7 ? '#1F8A4C' : '#C0392B', icon: IC.clock, tone: 'green'})
      + '<div class="kpi" style="background:#F2E7F7;border:1px solid #E4CFEE;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center"><button type="button" id="cpfrDl" title="Descargar reporte" style="cursor:pointer;width:44px;height:44px;border-radius:50%;border:0;background:var(--purple);color:#fff;display:grid;place-items:center"><span style="width:22px;height:22px;display:block">' + DL_ICON + '</span></button><span style="font-family:var(--font-display);font-weight:800;font-size:.82rem;line-height:1.15;color:var(--purple)">Descargar reporte</span><span style="font-style:italic;font-size:.72rem;color:var(--purple);opacity:.8">datos al ' + hasta + '</span></div>'
      + '</div>';
    html += '<div class="grid-charts">'
      + '<div class="panel-card"><div class="pc-head"><div><div class="pc-title">Estatus de casos</div><div class="pc-sub">Abierto · Persiste · Resuelto</div></div></div><div class="chart-box h-mid"><canvas id="cpfr-pie"></canvas></div></div>'
      + '<div class="panel-card"><div class="pc-head"><div><div class="pc-title">Casos por cadena</div><div class="pc-sub">Según estatus</div></div></div><div class="chart-box h-mid"><canvas id="cpfr-bar"></canvas></div></div>'
      + '</div>';
    html += '<div id="cpfrWrap"></div>';
    host.innerHTML = html;

    var est = {Abierto: 0, Persiste: 0, Resuelto: 0};
    casos.forEach(function (c) { est[cpfrDisplayEstatus(c)]++; });
    pieChart(document.getElementById('cpfr-pie'), ['Abierto', 'Persiste', 'Resuelto'], [est.Abierto, est.Persiste, est.Resuelto], [CPFR_EST_COLOR.Abierto, CPFR_EST_COLOR.Persiste, CPFR_EST_COLOR.Resuelto], function (n) { return num(n) + ' casos'; });

    var byCad = {};
    casos.forEach(function (c) { var e = cpfrDisplayEstatus(c); if (!byCad[c.cadena]) byCad[c.cadena] = {Abierto: 0, Persiste: 0, Resuelto: 0}; byCad[c.cadena][e]++; });
    var cads = Object.keys(byCad);
    var cb = new Chart(document.getElementById('cpfr-bar'), {type: 'bar', data: {labels: cads, datasets: ['Abierto', 'Persiste', 'Resuelto'].map(function (e) {
      return {label: e, data: cads.map(function (c) { return byCad[c][e]; }), backgroundColor: CPFR_EST_COLOR[e], borderRadius: 5, maxBarThickness: 44};
    })},
      options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {display: true, position: 'top', align: 'end', labels: {usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14, font: {weight: '600'}}}}, scales: {x: {grid: {display: false}, stacked: true}, y: {grid: {color: 'rgba(42,20,8,0.07)'}, stacked: true}}}});
    charts.push(cb);

    var dl = document.getElementById('cpfrDl'); if (dl) dl.addEventListener('click', cpfrDownload);
    renderCpfrMatrix();
  }

  function renderCpfrMatrix() {
    var rows = cpfrData.filter(function (c) { return cpfrStatusFilter === 'todos' || cpfrDisplayEstatus(c).toLowerCase() === cpfrStatusFilter; });
    function pill(est) {
      var col = est === 'Resuelto' ? 'background:rgba(31,138,76,.12);color:#1F8A4C'
        : (est === 'Persiste' ? 'background:rgba(192,57,43,.10);color:#C0392B' : 'background:rgba(242,160,61,.16);color:#B26A00');
      return '<td><span style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;font-weight:700;font-size:.74rem;' + col + '">' + est + '</span></td>';
    }
    var cols = [
      {key: 'fecha', label: 'Fecha', type: 'str', get: function (r) { return r.fecha || ''; }, cell: function (r) { return '<td>' + cpfrFmtFecha(r.fecha) + '</td>'; }},
      {key: 'cadena', label: 'Cadena', type: 'str', get: function (r) { return r.cadena || ''; }, cell: function (r) { return '<td>' + escapeHtml(r.cadena) + '</td>'; }},
      {key: 'local', label: 'Local', type: 'str', get: function (r) { return r.local || ''; }, cell: function (r) { return '<td>' + escapeHtml(r.local || '-') + '</td>'; }},
      {key: 'cod', label: 'Cod Producto', type: 'str', get: function (r) { return r.codigo_producto || ''; }, cell: function (r) { return '<td>' + escapeHtml(r.codigo_producto) + '</td>'; }},
      {key: 'prod', label: 'Producto', type: 'str', get: function (r) { return r.producto || ''; }, cell: function (r) { return '<td>' + escapeHtml(r.producto || '-') + '</td>'; }},
      {key: 'problema', label: 'Problema', type: 'str', get: function (r) { return r.problema || ''; }, cell: function (r) { return '<td>' + escapeHtml(r.problema) + '</td>'; }},
      {key: 'dias', label: 'Duración Problema', type: 'num', get: function (r) { return Number(r.duracion) || 0; }, cell: function (r) { return '<td>' + (Number(r.duracion) || 0) + '</td>'; }},
      {key: 'status', label: 'Estatus', type: 'str', get: function (r) { return cpfrDisplayEstatus(r); }, cell: function (r) { return pill(cpfrDisplayEstatus(r)); }}
    ];
    var body = smSortRows(cols, rows, cpfrSort).map(function (r) { return '<tr>' + cols.map(function (c) { return c.cell(r); }).join('') + '</tr>'; }).join('');
    if (!rows.length) body = '<tr><td colspan="' + cols.length + '" style="text-align:center;color:var(--muted);padding:26px">Sin casos con este estatus</td></tr>';
    function swBtn(m, label) { return '<button type="button" data-m="' + m + '"' + (cpfrStatusFilter === m ? ' class="on"' : '') + '>' + label + '</button>'; }
    document.getElementById('cpfrWrap').innerHTML = '<div class="panel-card full" id="cpfrMatrix" style="text-align:center"><div class="pc-head" style="text-align:left"><div><div class="pc-title">Detalle de casos · Local / Producto</div><div class="pc-sub">Seguimiento de quiebres y próximos quiebres · datos reales</div></div>'
      + '<div class="metric-switch" id="cpfrSw">' + swBtn('todos', 'Todos') + swBtn('abierto', 'Abierto') + swBtn('persiste', 'Persiste') + swBtn('resuelto', 'Resuelto') + '</div></div>'
      + '<div class="table-scroll"><table class="matrix" id="cpfrTable" style="font-size:.72rem;table-layout:fixed;width:100%;min-width:0"><colgroup><col style="width:11%"><col style="width:12%"><col style="width:17%"><col style="width:12%"><col style="width:15%"><col style="width:12%"><col style="width:10%"><col style="width:11%"></colgroup><thead>' + smThead(cols, cpfrSort) + '</thead><tbody>' + body + '</tbody></table></div></div>';
    smWire('#cpfrMatrix', cols, cpfrSort, renderCpfrMatrix);
    var sw = document.getElementById('cpfrSw'); if (sw) sw.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cpfrStatusFilter = b.getAttribute('data-m'); renderCpfrMatrix(); });
  }

  installStyles();
  installTabs();
  if (window.RENDER) {
    window.RENDER.proxq = panelProxQuiebres;
    window.RENDER.cpfr = renderCpfr;
  }
  if (window.AREA_LOG) {
    window.AREA_LOG.proxq = 'Próximos Quiebres';
    window.AREA_LOG.cpfr = 'Entregable CPFR';
  }
}());
