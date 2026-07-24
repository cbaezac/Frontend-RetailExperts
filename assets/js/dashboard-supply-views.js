(function () {
  'use strict';

  // Vistas Supply (cascarón de diseño — datos DEMO, sin conexión a servicios ni filtros):
  //   · Próximos Quiebres  -> window.RENDER.proxq = panelProxQuiebres
  //   · Entregable CPFR     -> window.RENDER.cpfr  = panelCpfr
  // Rediseño provisto por RE. Reutiliza los helpers globales del script principal
  // de dashboards.html: abaLocals, kpiCard, pieChart, smThead/smSortRows/smWire,
  // wireDrillMenu, drillChildren/drillName/drillCueHtml/drillBackHtml, chartColor,
  // num, numShort, pct, clsIns, IC, APERTURAS, COM, DEFAULT_PERIODS, host, charts, Chart.

  // Ícono de descarga (IC.download no existe en esta versión) — hereda color/tamaño del contenedor.
  var DL_ICON = '<svg viewBox="0 0 24 24" fill="none" style="width:100%;height:100%"><path d="M12 3v11m0 0l-4-4m4 4l4-4M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function isoOfLocal(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
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

  /* ---- Próximos Quiebres ---- */
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

  /* ---- Entregable CPFR ---- */
  var cpfrSort = {key: 'status', dir: 1}, cpfrStatusFilter = 'todos';
  var CPFR_TIPOS = ['Quiebre', 'Próximo quiebre 1d', 'Próximo quiebre 3d', 'Próximo quiebre 5d', 'Próximo quiebre 7d'];
  function cpfrDays() {
    var de = document.getElementById('f-desde'), ha = document.getElementById('f-hasta');
    var s = (de && de.value) || DEFAULT_PERIODS.yesterday.start, e = (ha && ha.value) || DEFAULT_PERIODS.yesterday.end;
    if (e < s) e = s;
    var days = Math.max(1, Math.min(45, Math.round((new Date(e) - new Date(s)) / 86400000) + 1));
    var out = [], base = new Date(e + 'T12:00:00');
    for (var i = days - 1; i >= 0; i--) { out.push(isoOfLocal(new Date(base.getTime() - i * 86400000))); }
    return out;
  }
  function cpfrFmtFecha(iso) { var p = iso.split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
  function cpfrCasos() {
    var L = abaLocals(), out = [], dias = cpfrDays();
    L.forEach(function (l) {
      var nP = 2 + (hashN(l.cod + 'cpfrn') % 3);
      for (var i = 0; i < nP; i++) {
        var pv = COM.aperturas.descriptor ? COM.aperturas.descriptor.values : [];
        var pi = hashN(l.cod + 'cp' + i) % (pv.length || 8);
        var prod = pv.length ? pv[pi].label : ('Producto ' + (pi + 1));
        var sku = 'SKU' + (1001 + pi);
        var h = hashN(l.cod + ':' + sku + ':cpfr');
        var resuelto = (h % 100) < 62;
        var diasProb = 1 + (h >>> 4) % 9;
        var fecha = dias[(h >>> 8) % dias.length];
        out.push({fecha: fecha, cad: l.cad, fmt: l.fmt, cod: l.cod, nom: l.nom, sku: sku, prod: prod, tipo: CPFR_TIPOS[h % CPFR_TIPOS.length], dias: diasProb, resuelto: resuelto});
      }
    });
    return out;
  }
  function panelCpfr() {
    if (needsData('cpfr', 'descriptor', panelCpfr)) return;
    var casos = cpfrCasos();
    var nRes = casos.filter(function (c) { return c.resuelto; }).length, nPer = casos.length - nRes;
    var ayer = cpfrFmtFecha(DEFAULT_PERIODS.yesterday.end);
    var html = '<div class="kpis" id="cpfrKpis" style="grid-template-columns:repeat(5,1fr)">'
      + kpiCard({label: 'Casos totales', value: num(casos.length), valueColor: '#5A0D74', icon: IC.box, tone: 'purple'})
      + kpiCard({label: 'Casos resueltos', value: num(nRes), valueColor: '#1F8A4C', icon: IC.check, tone: 'green'})
      + kpiCard({label: 'Casos persisten', value: num(nPer), valueColor: '#C0392B', icon: IC.lost, tone: 'accent'})
      + kpiCard({label: '% Casos Resueltos', value: casos.length ? pct(nRes / casos.length * 100) : '-', valueColor: casos.length && nRes / casos.length >= 0.7 ? '#1F8A4C' : '#C0392B', icon: IC.clock, tone: 'green'})
      + '<div class="kpi" style="background:#F2E7F7;border:1px solid #E4CFEE;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center"><button type="button" id="cpfrDl" title="Descargar reporte" style="cursor:pointer;width:44px;height:44px;border-radius:50%;border:0;background:var(--purple);color:#fff;display:grid;place-items:center"><span style="width:22px;height:22px;display:block">' + DL_ICON + '</span></button><span style="font-family:var(--font-display);font-weight:800;font-size:.82rem;line-height:1.15;color:var(--purple)">Descargar reporte de hoy</span><span style="font-style:italic;font-size:.72rem;color:var(--purple);opacity:.8">datos del ' + ayer + '</span></div>'
      + '</div>';
    html += '<div class="grid-charts">'
      + '<div class="panel-card"><div class="pc-head"><div><div class="pc-title">Estatus de casos</div><div class="pc-sub">Resueltos vs. persiste</div></div></div><div class="chart-box h-mid"><canvas id="cpfr-pie"></canvas></div></div>'
      + '<div class="panel-card"><div class="pc-head"><div><div class="pc-title">Casos por cadena</div><div class="pc-sub">Según estatus</div></div></div><div class="chart-box h-mid"><canvas id="cpfr-bar"></canvas></div></div>'
      + '</div>';
    html += '<div id="cpfrWrap"></div>';
    host.innerHTML = html;
    pieChart(document.getElementById('cpfr-pie'), ['Resuelto', 'Persiste'], [nRes, nPer], ['#7FC99A', '#E8918C'], function (n) { return num(n) + ' casos'; });
    var byCad = {}; casos.forEach(function (c) { if (!byCad[c.cad]) byCad[c.cad] = {r: 0, p: 0}; if (c.resuelto) byCad[c.cad].r++; else byCad[c.cad].p++; });
    var cads = Object.keys(byCad);
    var cb = new Chart(document.getElementById('cpfr-bar'), {type: 'bar', data: {labels: cads, datasets: [
      {label: 'Resuelto', data: cads.map(function (c) { return byCad[c].r; }), backgroundColor: 'rgba(127,201,154,.85)', borderRadius: 5, maxBarThickness: 44},
      {label: 'Persiste', data: cads.map(function (c) { return byCad[c].p; }), backgroundColor: 'rgba(232,145,140,.85)', borderRadius: 5, maxBarThickness: 44}
    ]},
      options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {display: true, position: 'top', align: 'end', labels: {usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 14, font: {weight: '600'}}}}, scales: {x: {grid: {display: false}, stacked: true}, y: {grid: {color: 'rgba(42,20,8,0.07)'}, stacked: true}}}});
    charts.push(cb);
    var dl = document.getElementById('cpfrDl'); if (dl) dl.addEventListener('click', function () { var t = document.getElementById('cpfrTable'); if (!t) return; var b = []; t.querySelectorAll('tr').forEach(function (tr) { b.push([].slice.call(tr.children).map(function (c) { return '"' + c.textContent.replace(/"/g, '""') + '"'; }).join(',')); }); var blob = new Blob(['﻿' + b.join('\n')], {type: 'text/csv;charset=utf-8'}); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Reporte_CPFR.csv'; a.click(); });
    renderCpfrMatrix(casos);
  }
  function renderCpfrMatrix(casos) {
    var rows = casos.filter(function (c) { return cpfrStatusFilter === 'todos' || (cpfrStatusFilter === 'resuelto' ? c.resuelto : !c.resuelto); });
    var cols = [
      {key: 'fecha', label: 'Fecha', type: 'str', get: function (r) { return r.fecha; }, cell: function (r) { return '<td>' + cpfrFmtFecha(r.fecha) + '</td>'; }},
      {key: 'cad', label: 'Cadena', type: 'str', get: function (r) { return r.cad; }, cell: function (r) { return '<td>' + r.cad + '</td>'; }},
      {key: 'cod', label: 'Cod Local', type: 'str', get: function (r) { return r.cod; }, cell: function (r) { return '<td>' + r.cod + '</td>'; }},
      {key: 'nom', label: 'Local', type: 'str', get: function (r) { return r.nom; }, cell: function (r) { return '<td>' + r.nom + '</td>'; }},
      {key: 'sku', label: 'Cod Producto', type: 'str', get: function (r) { return r.sku; }, cell: function (r) { return '<td>' + r.sku + '</td>'; }},
      {key: 'prod', label: 'Producto', type: 'str', get: function (r) { return r.prod; }, cell: function (r) { return '<td>' + r.prod + '</td>'; }},
      {key: 'tipo', label: 'Problema', type: 'str', get: function (r) { return r.tipo; }, cell: function (r) { return '<td>' + r.tipo + '</td>'; }},
      {key: 'dias', label: 'Duración Problema', type: 'num', get: function (r) { return r.dias; }, cell: function (r) { return '<td>' + r.dias + '</td>'; }},
      {key: 'status', label: 'Estatus', type: 'str', get: function (r) { return r.resuelto ? 'Resuelto' : 'Persiste'; }, cell: function (r) { return '<td><span style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;font-weight:700;font-size:.74rem;' + (r.resuelto ? 'background:rgba(31,138,76,.12);color:#1F8A4C' : 'background:rgba(192,57,43,.10);color:#C0392B') + '">' + (r.resuelto ? 'Resuelto' : 'Persiste') + '</span></td>'; }}
    ];
    var body = smSortRows(cols, rows, cpfrSort).map(function (r) { return '<tr>' + cols.map(function (c) { return c.cell(r); }).join('') + '</tr>'; }).join('');
    if (!rows.length) body = '<tr><td colspan="' + cols.length + '" style="text-align:center;color:var(--muted);padding:26px">Sin casos con este estatus</td></tr>';
    document.getElementById('cpfrWrap').innerHTML = '<div class="panel-card full" id="cpfrMatrix" style="text-align:center"><div class="pc-head" style="text-align:left"><div><div class="pc-title">Detalle de casos · Local / Producto</div><div class="pc-sub">Seguimiento de quiebres y próximos quiebres</div></div>'
      + '<div class="metric-switch" id="cpfrSw"><button type="button" data-m="todos"' + (cpfrStatusFilter === 'todos' ? ' class="on"' : '') + '>Todos</button><button type="button" data-m="resuelto"' + (cpfrStatusFilter === 'resuelto' ? ' class="on"' : '') + '>Resueltos</button><button type="button" data-m="persiste"' + (cpfrStatusFilter === 'persiste' ? ' class="on"' : '') + '>Persiste</button></div></div>'
      + '<div class="table-scroll"><table class="matrix" id="cpfrTable" style="font-size:.72rem;table-layout:fixed;width:100%;min-width:0"><colgroup><col style="width:12%"><col style="width:11%"><col style="width:9%"><col style="width:14%"><col style="width:11%"><col style="width:14%"><col style="width:11%"><col style="width:11%"><col style="width:11%"></colgroup><thead>' + smThead(cols, cpfrSort) + '</thead><tbody>' + body + '</tbody></table></div></div>';
    smWire('#cpfrMatrix', cols, cpfrSort, function () { renderCpfrMatrix(casos); });
    var sw = document.getElementById('cpfrSw'); if (sw) sw.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cpfrStatusFilter = b.getAttribute('data-m'); renderCpfrMatrix(casos); });
  }

  installStyles();
  installTabs();
  if (window.RENDER) {
    window.RENDER.proxq = panelProxQuiebres;
    window.RENDER.cpfr = panelCpfr;
  }
  if (window.AREA_LOG) {
    window.AREA_LOG.proxq = 'Próximos Quiebres';
    window.AREA_LOG.cpfr = 'Entregable CPFR';
  }
}());
