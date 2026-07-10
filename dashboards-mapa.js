/* ============================================================
   Dashboards · Mapa de Chile — Rendimiento General por Región
   Expone window.__renderMapa(hostEl)
   - Carga d3 + GeoJSON de las 16 regiones (una vez)
   - Ordena regiones norte→sur por centroide; filtra islas oceánicas y Antártica
   - Datos sintéticos a nivel de LOCAL en 3 métricas: venta $, venta costo, unidades
   - Crecimiento = período en curso vs. mismo período del año anterior
   - Interacción: hover → clic fija región → clic en cadena abre sus locales
   ============================================================ */
(function () {
  'use strict';

  var GEO_URL = 'https://cdn.jsdelivr.net/gh/caracena/chile-geojson@master/regiones.json';
  var D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';

  var CAD = [
    { k: 'Cencosud', dot: '#2E8B57' },
    { k: 'Walmart',  dot: '#3B76C2' },
    { k: 'SMU',      dot: '#C84B44' },
    { k: 'Tottus',   dot: '#C79216' }
  ];
  var CAD_FACTOR = { Cencosud: 2.0, Walmart: 3.0, SMU: 4.0, Tottus: 0.6 };
  var FORMATS = {
    Cencosud: ['Jumbo', 'Santa Isabel'],
    Walmart: ['Líder', 'Líder Express', 'acuenta'],
    SMU: ['Unimarc', 'Alvi', 'Mayorista 10'],
    Tottus: ['Tottus']
  };
  var PREFIX = { Cencosud: 'CEN', Walmart: 'WMT', SMU: 'SMU', Tottus: 'TOT' };
  /* Catálogo por categoría (para el nivel producto) */
  var CATS = {
    'Abarrotes': ['Arroz Grado 1', 'Fideos Spaghetti', 'Aceite Vegetal 1L', 'Azúcar Granulada', 'Harina sin Polvos', 'Atún en Lomos'],
    'Lácteos': ['Leche Entera 1L', 'Yogurt Batido', 'Mantequilla 250g', 'Queso Gauda', 'Leche Descremada 1L'],
    'Bebidas': ['Bebida Cola 1.5L', 'Agua Mineral 1.5L', 'Jugo Néctar 1L', 'Bebida Naranja 2L', 'Agua con Gas 1.5L'],
    'Carnes': ['Pechuga de Pollo kg', 'Carne Molida kg', 'Longaniza', 'Filete de Vacuno kg', 'Pollo Entero kg'],
    'Frutas y Verduras': ['Plátano kg', 'Tomate kg', 'Palta Hass kg', 'Manzana Roja kg', 'Lechuga Costina'],
    'Panadería': ['Pan Marraqueta kg', 'Pan de Molde', 'Hallulla kg', 'Tortilla', 'Pan Integral'],
    'Limpieza': ['Detergente 3L', 'Cloro 900ml', 'Lavaloza 750ml', 'Papel Higiénico 12u', 'Toalla de Papel'],
    'Perfumería': ['Shampoo 400ml', 'Jabón de Tocador', 'Pasta Dental', 'Desodorante', 'Acondicionador 400ml'],
    'Congelados': ['Papas Fritas 1kg', 'Nuggets de Pollo', 'Helado 1L', 'Verduras Salteadas', 'Pizza Congelada'],
    'Mascotas': ['Alimento Perro 3kg', 'Alimento Gato 1.5kg', 'Snack Perro', 'Arena Sanitaria']
  };
  var CATNAMES = Object.keys(CATS);

  /* Métricas seleccionables */
  var METRICS = [
    { k: 'pesos', label: 'Venta $', short: 'Pesos' },
    { k: 'costo', label: 'Venta costo', short: 'Costo' },
    { k: 'unidades', label: 'Unidades', short: 'Unidades' }
  ];
  var mode = 'pesos'; // métrica activa

  /* 16 regiones, norte → sur */
  var REGION_NAMES = [
    ['Arica y Parinacota', 'XV'], ['Tarapacá', 'I'], ['Antofagasta', 'II'], ['Atacama', 'III'],
    ['Coquimbo', 'IV'], ['Valparaíso', 'V'], ['Metropolitana', 'RM'], ["O'Higgins", 'VI'],
    ['Maule', 'VII'], ['Ñuble', 'XVI'], ['Biobío', 'VIII'], ['La Araucanía', 'IX'],
    ['Los Ríos', 'XIV'], ['Los Lagos', 'X'], ['Aysén', 'XI'], ['Magallanes', 'XII']
  ];
  var WEIGHT = [2, 3, 5, 3, 5, 12, 40, 7, 8, 4, 14, 8, 3, 6, 2, 2];
  /* Comunas reales por región (orden alineado a REGION_NAMES) */
  var REGION_COMUNAS = [
    ['Arica', 'Putre', 'Camarones'],
    ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Pica'],
    ['Antofagasta', 'Calama', 'Tocopilla', 'Mejillones', 'Taltal'],
    ['Copiapó', 'Vallenar', 'Caldera', 'Chañaral', 'Diego de Almagro'],
    ['La Serena', 'Coquimbo', 'Ovalle', 'Illapel', 'Vicuña'],
    ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'San Antonio', 'Quillota'],
    ['Santiago', 'Providencia', 'Las Condes', 'Maipú', 'Puente Alto', 'La Florida', 'Ñuñoa'],
    ['Rancagua', 'San Fernando', 'Rengo', 'Machalí', 'Santa Cruz'],
    ['Talca', 'Curicó', 'Linares', 'Cauquenes', 'Constitución'],
    ['Chillán', 'Chillán Viejo', 'San Carlos', 'Bulnes'],
    ['Concepción', 'Talcahuano', 'Los Ángeles', 'Coronel', 'Chiguayante', 'San Pedro de la Paz'],
    ['Temuco', 'Padre Las Casas', 'Angol', 'Villarrica', 'Pucón'],
    ['Valdivia', 'La Unión', 'Río Bueno', 'Panguipulli'],
    ['Puerto Montt', 'Osorno', 'Castro', 'Puerto Varas', 'Ancud'],
    ['Coyhaique', 'Puerto Aysén', 'Chile Chico'],
    ['Punta Arenas', 'Puerto Natales', 'Porvenir']
  ];

  function seed(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function pad3(n) { n = String(n); while (n.length < 3) n = '0' + n; return n; }
  function fmtInt(n) { return (n | 0).toLocaleString('es-CL'); }
  function fmtPct(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; }
  function cls(v) { return v >= 0 ? 'pos' : 'neg'; }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function metricLabel() { return METRICS.filter(function (m) { return m.k === mode; })[0].label; }

  /* agrega una lista de locales para una métrica dada */
  function aggregate(locales, key) {
    var arr = locales.map(function (l) { return l.cr[key]; });
    return {
      total: locales.length,
      up: arr.filter(function (x) { return x > 0; }).length,
      down: arr.filter(function (x) { return x < 0; }).length,
      crec: r1(mean(arr))
    };
  }

  /* ---------- datos: reales (venta_historica, MTD vs LY) con respaldo sintético ---------- */
  var MAPDATA = null, NAT = null, MAPA_REAL = false;
  function demoMapData() { return REGION_NAMES.map(function (nm, ri) {
    var chains = CAD.map(function (c, ci) {
      var s0 = seed(ri * 13 + ci + 1);
      var n = Math.max(2, Math.round(WEIGHT[ri] * CAD_FACTOR[c.k] * (0.7 + s0 * 0.6)));
      var fmts = FORMATS[c.k];
      var locales = [];
      for (var j = 0; j < n; j++) {
        var s1 = seed(ri * 7 + ci * 131 + j * 3 + 11);
        var s2 = seed(ri * 17 + ci * 97 + j * 5 + 23);
        var s3 = seed(ri * 23 + ci * 61 + j * 9 + 41);
        var s4 = seed(ri * 5 + ci * 53 + j * 11 + 7);
        var crecP = r1(s1 * 46 - 22);                 // venta $   -22%..+24%
        var crecC = r1(crecP + (s4 * 9 - 4.5));        // venta costo (similar a $)
        var crecU = r1(crecP - (2 + s2 * 8));          // unidades (crece menos que $)
        var cumplP = r1(84 + s2 * 32);                 // 84%..116%
        var cumplC = r1(cumplP + (s3 * 6 - 3));
        var cumplU = r1(cumplP - s4 * 8);
        var fmt = fmts[Math.floor(s3 * fmts.length) % fmts.length];
        var com = REGION_COMUNAS[ri][Math.floor(seed(ri * 3 + j * 7 + ci * 5) * REGION_COMUNAS[ri].length) % REGION_COMUNAS[ri].length];
        var prods = [];
        var nP = 6 + Math.floor(s4 * 9); // 6..14 productos
        for (var q = 0; q < nP; q++) {
          var q1 = seed(ri * 3 + ci * 17 + j * 29 + q * 7 + 3);
          var q2 = seed(ri * 11 + ci * 23 + j * 31 + q * 13 + 5);
          var cat = CATNAMES[Math.floor(q1 * CATNAMES.length) % CATNAMES.length];
          var plist = CATS[cat];
          var pcP = r1(q1 * 52 - 26);
          var pcC = r1(pcP + (q2 * 10 - 5));
          var pcU = r1(pcP - (2 + q2 * 8));
          prods.push({ cat: cat, name: plist[Math.floor(q2 * plist.length) % plist.length], cr: { pesos: pcP, costo: pcC, unidades: pcU } });
        }
        locales.push({
          cod: PREFIX[c.k] + '-' + (nm[1] || ri) + '-' + pad3(j + 1), nombre: fmt, comuna: com,
          cr: { pesos: crecP, costo: crecC, unidades: crecU },
          cu: { pesos: cumplP, costo: cumplC, unidades: cumplU }, prod: prods
        });
      }
      return {
        k: c.k, dot: c.dot, locales: locales,
        agg: { pesos: aggregate(locales, 'pesos'), costo: aggregate(locales, 'costo'), unidades: aggregate(locales, 'unidades') }
      };
    });
    var all = []; chains.forEach(function (ch) { all = all.concat(ch.locales); });
    return {
      name: nm[0], roman: nm[1], chains: chains,
      agg: { pesos: aggregate(all, 'pesos'), costo: aggregate(all, 'costo'), unidades: aggregate(all, 'unidades') }
    };
  }); }

  function buildNat() {
    var all = [], chainMap = {}, order = [];
    MAPDATA.forEach(function (r) { r.chains.forEach(function (ch) {
      all = all.concat(ch.locales);
      if (!chainMap[ch.k]) { chainMap[ch.k] = { k: ch.k, dot: ch.dot, locales: [] }; order.push(ch.k); }
      chainMap[ch.k].locales = chainMap[ch.k].locales.concat(ch.locales);
    }); });
    var chains = order.sort().map(function (k) {
      var c = chainMap[k];
      return { k: c.k, dot: c.dot, agg: { pesos: aggregate(c.locales, 'pesos'), costo: aggregate(c.locales, 'costo'), unidades: aggregate(c.locales, 'unidades') } };
    });
    return {
      name: 'Chile · Total nacional', roman: '', chains: chains,
      agg: { pesos: aggregate(all, 'pesos'), costo: aggregate(all, 'costo'), unidades: aggregate(all, 'unidades') }
    };
  }

  function fmtCadMapa(v){ v = String(v || ''); return v.toLowerCase() === 'smu' ? 'SMU' : v.charAt(0).toUpperCase() + v.slice(1); }
  var MAPA_DOTS = { Cencosud: '#2E8B57', Walmart: '#3B76C2', SMU: '#C84B44', Tottus: '#C79216' };
  var MAPA_DOT_FALLBACK = ['#8E5BA6', '#C77B3A', '#4E8F8B', '#A3564D'];
  var REGION_CODE_INDEX = { 15:0, 1:1, 2:2, 3:3, 4:4, 5:5, 13:6, 6:7, 7:8, 16:9, 8:10, 9:11, 14:12, 10:13, 11:14, 12:15 };
  function growth(v, ly) { return ly > 0 ? r1((v / ly - 1) * 100) : 0; }
  function buildRealData(rows) {
    var regs = REGION_NAMES.map(function (nm) { return { name: nm[0], roman: nm[1], byChain: {} }; });
    rows.forEach(function (rw) {
      var code = parseInt(String(rw.region || '').trim(), 10);
      var idx = REGION_CODE_INDEX[code]; if (idx === undefined) return;
      var cad = fmtCadMapa(rw.cadena || 'Otra');
      if (!regs[idx].byChain[cad]) regs[idx].byChain[cad] = [];
      regs[idx].byChain[cad].push({
        cod: rw.codigo, nombre: rw.nombre || rw.codigo, comuna: rw.comuna || '',
        cr: { pesos: growth(rw.venta_pesos, rw.venta_pesos_ly), costo: growth(rw.venta_costo, rw.venta_costo_ly), unidades: growth(rw.venta_unidades, rw.venta_unidades_ly) },
        cu: { pesos: 0, costo: 0, unidades: 0 }, prod: null
      });
    });
    var di = 0;
    return regs.map(function (reg) {
      var chains = Object.keys(reg.byChain).sort().map(function (cad) {
        var loc = reg.byChain[cad];
        return { k: cad, dot: MAPA_DOTS[cad] || MAPA_DOT_FALLBACK[(di++) % 4], locales: loc,
          agg: { pesos: aggregate(loc, 'pesos'), costo: aggregate(loc, 'costo'), unidades: aggregate(loc, 'unidades') } };
      });
      var all = []; chains.forEach(function (ch) { all = all.concat(ch.locales); });
      return { name: reg.name, roman: reg.roman, chains: chains,
        agg: { pesos: aggregate(all, 'pesos'), costo: aggregate(all, 'costo'), unidades: aggregate(all, 'unidades') } };
    });
  }
  var _datap = null;
  function mapaFiltros() {
    var f = (typeof window.fbFilterParams === 'function') ? window.fbFilterParams() : {};
    return window.withCliente(Object.assign({}, f));
  }
  function ensureData() {
    if (_datap) return _datap;
    var canReal = window.RetailAPI && typeof window.withCliente === 'function';
    _datap = (canReal
      ? window.RetailAPI.requestJson('/web/dashboard/mapa' + window.RetailAPI.buildQuery(mapaFiltros()))
          .then(function (r) { MAPDATA = buildRealData(r.locales || []); MAPA_REAL = true; })
          .catch(function () { MAPDATA = demoMapData(); MAPA_REAL = false; })
      : Promise.resolve().then(function () { MAPDATA = demoMapData(); }))
      .then(function () { NAT = buildNat(); });
    return _datap;
  }
  // Permite al dashboard invalidar la caché del mapa al aplicar filtros
  window.__mapaInvalidate = function () { _datap = null; MAPDATA = null; NAT = null; };

  /* ---------- carga diferida ---------- */
  var _d3p = null, _geop = null;
  function loadD3() {
    if (window.d3) return Promise.resolve(window.d3);
    if (_d3p) return _d3p;
    _d3p = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = D3_URL; s.onload = function () { res(window.d3); }; s.onerror = rej; document.head.appendChild(s); });
    return _d3p;
  }
  function loadGeo() { if (_geop) return _geop; _geop = fetch(GEO_URL).then(function (r) { return r.json(); }).then(cleanGeo); return _geop; }

  function cleanGeo(fc) {
    var feats = (fc.features || []).map(function (f) {
      var g = f.geometry; if (!g) return null;
      var polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
      var kept = [];
      polys.forEach(function (poly) {
        var ring = poly[0]; if (!ring || !ring.length) return;
        var mlon = 0, mlat = 0; ring.forEach(function (p) { mlon += p[0]; mlat += p[1]; });
        mlon /= ring.length; mlat /= ring.length;
        if (mlon < -77) return;      // islas oceánicas
        if (mlat < -56.8) return;    // Antártica
        kept.push(poly);
      });
      if (!kept.length) return null;
      var big = kept.slice().sort(function (a, b) { return b[0].length - a[0].length; })[0][0];
      var clat = 0; big.forEach(function (p) { clat += p[1]; }); clat /= big.length;
      return { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: kept }, _clat: clat };
    }).filter(Boolean);
    feats.sort(function (a, b) { return b._clat - a._clat; });
    feats.forEach(function (f, i) { f.properties = MAPDATA[i] || { name: 'Región ' + (i + 1), roman: '', chains: [], agg: {} }; });
    return { type: 'FeatureCollection', features: feats.slice(0, 16) };
  }

  /* ---------- estado de vista ---------- */
  var pinned = null, drill = null, drillLoc = null, hover = null;
  var _d3, _svg, _paths, _color;

  function regCrec(r) { return (r.agg && r.agg[mode]) ? r.agg[mode].crec : 0; }
  function colorScale() {
    var vals = MAPDATA.map(regCrec);
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    return _d3.scaleLinear().domain([mn, 0, mx]).range(['#C0392B', '#F6EBD2', '#1F8A4C']).clamp(true);
  }
  function fillFor(r) { return (r && r.agg && r.agg[mode]) ? _color(regCrec(r)) : '#EDE3D4'; }

  /* ---------- render principal ---------- */
  window.__renderMapa = function (hostEl) {
    var host = hostEl || document.getElementById('panelHost');
    if (!host) return;
    pinned = null; drill = null; drillLoc = null; hover = null;

    host.innerHTML =
      '<div class="panel-card full mapa-card">' +
        '<div class="pc-head">' +
          '<div><div class="pc-title">Mapa de Chile — Rendimiento General por Región</div>' +
          '<div class="pc-sub">Pasa el cursor sobre una región para ver un mayor detalle a nivel de cadena</div></div>' +
        '</div>' +
        '<div class="mapa-note">Crecimiento / decrecimiento = venta del período en curso (mes actual, month to date) vs. <b>el mismo período del año anterior</b>.</div>' +
        '<div class="mapa-body">' +
          '<div class="mapa-mapwrap">' +
            '<div class="mapa-maphead">' +
              '<div class="mapa-legend" id="mapaLegend"></div>' +
              '<div class="mapa-metricwrap">' +
                '<div class="mapa-metriclbl">Métrica de venta</div>' +
                '<div class="mapa-seg" id="mapaSeg">' +
                  METRICS.map(function (m) { return '<button type="button" data-m="' + m.k + '"' + (m.k === mode ? ' class="on"' : '') + '>' + m.short + '</button>'; }).join('') +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="mapa-svgbox" id="mapaSvg"><div class="mapa-loading">Cargando mapa…</div></div>' +
          '</div>' +
          '<div class="mapa-detail" id="mapaDetail"></div>' +
        '</div>' +
      '</div>';

    injectStyles();
    renderDetail();

    document.getElementById('mapaSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      mode = b.getAttribute('data-m');
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      recolor(); renderLegend(); renderDetail();
    });

    var det = document.getElementById('mapaDetail');
    det.addEventListener('click', function (e) {
      var un = e.target.closest('[data-act="unpin"]');
      if (un) { pinned = null; drill = null; drillLoc = null; styleRegions(null); renderDetail(); return; }
      var blc = e.target.closest('[data-act="backloc"]');
      if (blc) { drillLoc = null; renderDetail(); det.scrollTop = 0; return; }
      var bk = e.target.closest('[data-act="back"]');
      if (bk) { drill = null; drillLoc = null; renderDetail(); det.scrollTop = 0; return; }
      var lc = e.target.closest('[data-loc]');
      if (lc && pinned && drill) { drillLoc = parseInt(lc.getAttribute('data-loc'), 10); renderDetail(); det.scrollTop = 0; return; }
      var ch = e.target.closest('[data-chain]');
      if (ch && pinned) { drill = ch.getAttribute('data-chain'); drillLoc = null; renderDetail(); det.scrollTop = 0; return; }
    });

    ensureData().then(function () { renderDetail(); return Promise.all([loadD3(), loadGeo()]); }).then(function (arr) { drawMap(arr[0], arr[1]); })
      .catch(function (err) {
        var box = document.getElementById('mapaSvg');
        if (box) box.innerHTML = '<div class="mapa-loading">No se pudo cargar la geometría del mapa.<br><span style="font-size:.8em;opacity:.7">' + (err && err.message ? err.message : 'error de red') + '</span></div>';
      });
  };

  function drawMap(d3, fc) {
    _d3 = d3;
    var box = document.getElementById('mapaSvg'); if (!box) return;
    box.innerHTML = '';
    var W = 400, H = 1560;
    var proj = d3.geoMercator().fitExtent([[14, 16], [W - 14, H - 16]], fc);
    var path = d3.geoPath().projection(proj);
    _color = colorScale();

    var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('class', 'mapa-svg').attr('preserveAspectRatio', 'xMidYMid meet');
    _svg = svg;
    var tip = d3.select(box).append('div').attr('class', 'mapa-tip').style('opacity', 0);

    _paths = svg.selectAll('path').data(fc.features).enter().append('path')
      .attr('d', path).attr('fill', function (d) { return fillFor(d.properties); })
      .attr('stroke', '#FFF8E7').attr('stroke-width', 0.9).attr('class', 'mapa-region')
      .on('mousemove', function (ev, d) {
        var r = d.properties, b = box.getBoundingClientRect(), a = r.agg[mode];
        tip.html('<b>' + r.name + '</b>' + (r.roman ? ' · ' + r.roman : '') + '<br><span class="' + cls(a.crec) + '">' + fmtPct(a.crec) + '</span> · ' + fmtInt(a.total) + ' locales <i>(' + metricLabel() + ')</i>')
          .style('left', Math.min(ev.clientX - b.left + 16, W + 30) + 'px')
          .style('top', (ev.clientY - b.top + 10) + 'px').style('opacity', 1);
        hover = r; styleRegions(d); if (!pinned) renderDetail();
      })
      .on('click', function (ev, d) {
        if (pinned === d.properties) { pinned = null; drill = null; drillLoc = null; }
        else { pinned = d.properties; drill = null; drillLoc = null; }
        styleRegions(d); renderDetail();
      })
      .on('mouseleave', function () { tip.style('opacity', 0); });

    svg.on('mouseleave', function () { hover = null; styleRegions(null); if (!pinned) renderDetail(); });
    styleRegions(null);
    renderLegend();
  }

  function styleRegions(hoverD) {
    if (!_paths) return;
    _paths.attr('stroke', function (x) { return (pinned && x.properties === pinned) ? '#241026' : (x === hoverD ? '#241026' : '#FFF8E7'); })
      .attr('stroke-width', function (x) { return (pinned && x.properties === pinned) ? 2.6 : (x === hoverD ? 1.9 : 0.9); });
    _paths.filter(function (x) { return (pinned && x.properties === pinned) || x === hoverD; }).raise();
  }

  function recolor() {
    if (!_d3 || !_paths) return;
    _color = colorScale();
    _paths.transition().duration(260).attr('fill', function (d) { return fillFor(d.properties); });
  }

  function renderLegend() {
    var el = document.getElementById('mapaLegend'); if (!el) return;
    var vals = MAPDATA.map(regCrec);
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    el.innerHTML =
      '<div class="lg-title">Crecimiento general por región · <span class="lg-metric">' + metricLabel() + '</span></div>' +
      '<div class="lg-bar" style="background:linear-gradient(90deg,#C0392B 0%,#F6EBD2 50%,#1F8A4C 100%)"></div>' +
      '<div class="lg-scale"><span>' + fmtPct(mn) + '</span><span>0%</span><span>' + fmtPct(mx) + '</span></div>';
  }

  /* ---------- panel derecho ---------- */
  function kpi(num, label, klass) {
    return '<div class="mapa-kpi"><div class="mapa-kn ' + (klass || '') + '">' + num + '</div><div class="mapa-kl">' + label + '</div></div>';
  }
  function kpiGrid(a) {
    return '<div class="mapa-kpis">' +
      kpi(fmtInt(a.total), 'Cantidad Locales') +
      kpi(fmtPct(a.crec), 'Crecimiento General', 'big ' + cls(a.crec)) +
      kpi(fmtInt(a.up), 'Locales con Crecimiento', 'pos') +
      kpi(fmtInt(a.down), 'Locales con Decrecimiento', 'neg') +
      '</div>';
  }
  function galCam(ap, val, nav) {
    return '<span class="drill-cue mapa-galcue" title="Opciones" data-gal-ap="' + ap + '" data-gal-val="' + String(val).replace(/"/g, '&quot;') + '"' + (nav ? ' data-nav="' + nav + '"' : '') + '><svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.mapa-galcue');
    if (!c) return;
    e.preventDefault(); e.stopPropagation();
    if (!window.__openDrillMenu) return;
    var nav = c.getAttribute('data-nav');
    var opts = [];
    if (nav === 'chain') opts = [['local', 'Local']];
    else if (nav === 'loc') opts = [['producto', 'Producto']];
    var det = document.getElementById('mapaDetail');
    window.__openDrillMenu(c, {
      options: opts,
      gallery: { ap: c.getAttribute('data-gal-ap'), val: c.getAttribute('data-gal-val') },
      onPick: function () {
        var row = c.closest('[data-chain],[data-loc]');
        if (row && row.getAttribute('data-chain') != null) { drill = row.getAttribute('data-chain'); drillLoc = null; }
        else if (row && row.getAttribute('data-loc') != null) { drillLoc = parseInt(row.getAttribute('data-loc'), 10); }
        renderDetail(); if (det) det.scrollTop = 0;
      }
    });
  }, true);

  function chainTable(chains, clickable) {
    var head = '<div class="mapa-chead">' +
      '<span></span><span>Cadena</span>' +
      '<span>Cantidad Locales</span><span>Crecimiento General</span>' +
      '<span>Locales con Crecimiento</span><span>Locales con Decrecimiento</span></div>';
    var rows = chains.map(function (c) {
      var a = c.agg[mode];
      return '<div class="mapa-crow' + (clickable ? ' click' : '') + '"' + (clickable ? ' data-chain="' + c.k + '"' : '') + '>' +
        '<span class="mapa-cdot" style="background:' + c.dot + '"></span>' +
        '<span class="mapa-cname">' + c.k + (clickable ? galCam('cadena', c.k, 'chain') : galCam('cadena', c.k)) + '</span>' +
        '<span class="mapa-cnum">' + fmtInt(a.total) + '</span>' +
        '<span class="mapa-cperf ' + cls(a.crec) + '">' + fmtPct(a.crec) + '</span>' +
        '<span class="mapa-cup">' + fmtInt(a.up) + '</span>' +
        '<span class="mapa-cdown">' + fmtInt(a.down) + '</span>' +
        '</div>';
    }).join('');
    return head + rows;
  }

  function renderDetail() {
    var el = document.getElementById('mapaDetail'); if (!el) return;
    if (!NAT) { el.innerHTML = '<div class="mapa-loading" style="position:static;padding:30px;text-align:center;color:#6E6275">Cargando datos…</div>'; return; }
    if (pinned && drill && drillLoc != null) { el.innerHTML = productHTML(pinned, drill, drillLoc); return; }
    if (pinned && drill) { el.innerHTML = drillHTML(pinned, drill); return; }
    var r = pinned || hover;
    if (!r) { el.innerHTML = summaryHTML(NAT, 'nat'); return; }
    el.innerHTML = summaryHTML(r, pinned ? 'pinned' : 'hover');
  }

  function summaryHTML(r, mode2) {
    var head;
    if (mode2 === 'nat') {
      head = '<div class="mapa-dhead"><div class="mapa-dname">' + r.name + '</div>' +
        '<div class="mapa-dnat">Resumen nacional — pasa el cursor o haz clic en una región</div></div>';
    } else if (mode2 === 'pinned') {
      head = '<div class="mapa-dhead">' +
        '<div class="mapa-pinrow"><span class="mapa-roman">' + r.roman + '</span><span class="mapa-pinbadge">● Fijado</span>' +
        '<button type="button" class="mapa-unpin" data-act="unpin">✕ Quitar</button></div>' +
        '<div class="mapa-dname">' + r.name + galCam('region', r.name) + '</div>' +
        '<div class="mapa-dsub">Haz clic en una cadena para ver sus locales</div></div>';
    } else {
      head = '<div class="mapa-dhead"><span class="mapa-roman">' + r.roman + '</span>' +
        '<div class="mapa-dname">' + r.name + galCam('region', r.name) + '</div>' +
        '<div class="mapa-dhint">Haz clic para fijar y explorar por cadena</div></div>';
    }
    return head + kpiGrid(r.agg[mode]) +
      '<div class="mapa-sec">Detalle por cadena · <span class="mapa-secmetric">' + metricLabel() + '</span></div>' +
      chainTable(r.chains, mode2 === 'pinned');
  }

  function drillHTML(region, chainKey) {
    var ch = region.chains.filter(function (c) { return c.k === chainKey; })[0];
    if (!ch) return summaryHTML(region, 'pinned');
    var a = ch.agg[mode];
    var locs = ch.locales.map(function (l, i) { return { l: l, i: i }; }).sort(function (x, y) { return y.l.cr[mode] - x.l.cr[mode]; });
    var rows = locs.map(function (o) {
      var l = o.l;
      return '<div class="mapa-lrow click" data-loc="' + o.i + '">' +
        '<span class="mapa-lcode">' + l.cod + '</span>' +
        '<span class="mapa-lname">' + l.nombre + galCam('codlocal', l.cod, 'loc') + '</span>' +
        '<span class="mapa-lperf ' + cls(l.cr[mode]) + '">' + fmtPct(l.cr[mode]) + '</span>' +
        '</div>';
    }).join('');
    return '<div class="mapa-dhead">' +
        '<button type="button" class="mapa-back" data-act="back"><svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> ' + region.roman + ' · ' + region.name + '</button>' +
        '<div class="mapa-drillname"><span class="mapa-cdot" style="background:' + ch.dot + '"></span>' + ch.k + '</div>' +
        '<div class="mapa-dsub">' + fmtInt(a.total) + ' locales en ' + region.name + ' · <span class="mapa-secmetric">' + metricLabel() + '</span></div></div>' +
      kpiGrid(a) +
      '<div class="mapa-sec">Locales · haz clic para ver productos</div>' +
      '<div class="mapa-lhead"><span>Código Local</span><span>Nombre Local</span><span>Crecimiento</span></div>' +
      rows;
  }

  function productHTML(region, chainKey, locIdx) {
    var ch = region.chains.filter(function (c) { return c.k === chainKey; })[0];
    if (!ch || !ch.locales[locIdx]) return drillHTML(region, chainKey);
    var l = ch.locales[locIdx];
    if (l.prod === null) {
      if (!l._loadingProd) {
        l._loadingProd = true;
        window.RetailAPI.requestJson('/web/dashboard/mapa/productos' + window.RetailAPI.buildQuery(window.withCliente(Object.assign((typeof window.fbFilterParams === 'function' ? window.fbFilterParams() : {}), { codigo_local: l.cod }))))
          .then(function (r) {
            l.prod = (r.productos || []).map(function (p) {
              return { cat: p.categoria || '\u2014', name: p.nombre, cr: { pesos: growth(p.venta_pesos, p.venta_pesos_ly), costo: growth(p.venta_costo, p.venta_costo_ly), unidades: growth(p.venta_unidades, p.venta_unidades_ly) } };
            });
            renderDetail();
          })
          .catch(function () { l.prod = []; renderDetail(); });
      }
      return '<div class="mapa-dhead">' +
        '<button type="button" class="mapa-back" data-act="backloc"><svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> ' + ch.k + ' \u00b7 ' + region.name + '</button>' +
        '<div class="mapa-drillname">' + l.nombre + '</div></div>' +
        '<div class="mapa-loading" style="position:static;padding:26px;text-align:center;color:#6E6275">Cargando productos\u2026</div>';
    }
    var prods = l.prod.slice().sort(function (x, y) { return y.cr[mode] - x.cr[mode]; });
    var rows = prods.map(function (p) {
      return '<div class="mapa-prow">' +
        '<span class="mapa-pcat">' + p.cat + '</span>' +
        '<span class="mapa-pname">' + p.name + '</span>' +
        '<span class="mapa-pperf ' + cls(p.cr[mode]) + '">' + fmtPct(p.cr[mode]) + '</span>' +
        '</div>';
    }).join('');
    return '<div class="mapa-dhead">' +
        '<button type="button" class="mapa-back" data-act="backloc"><svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> ' + ch.k + ' · ' + region.name + '</button>' +
        '<div class="mapa-drillname"><span class="mapa-cdot" style="background:' + ch.dot + '"></span>' + l.nombre + '</div>' +
        '<div class="mapa-dsub">' + l.cod + ' · ' + l.comuna + ' · <span class="mapa-secmetric">' + metricLabel() + '</span></div></div>' +
      '<div class="mapa-sec">Productos · ordenados por crecimiento</div>' +
      '<div class="mapa-phead"><span>Categoría</span><span>Producto</span><span>Crecimiento</span></div>' +
      rows;
  }

  /* ---------- estilos ---------- */
  function injectStyles() {
    if (document.getElementById('mapa-styles')) return;
    var css =
      '.mapa-card .pc-head{align-items:flex-start;gap:20px;}' +
      '.mapa-metricwrap{flex:0 0 auto;text-align:right;margin-right:68px;}' +
      '.mapa-maphead{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;}' +
      '.mapa-metriclbl{font-family:var(--font-display,sans-serif);font-weight:700;font-size:.64rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#6E6275);margin-bottom:6px;}' +
      '.mapa-seg{display:inline-flex;background:#fff;border:1.4px solid var(--line,#eadfce);border-radius:999px;padding:3px;gap:2px;}' +
      '.mapa-seg button{font-family:var(--font-display,sans-serif);font-weight:700;font-size:.8rem;color:var(--muted,#6E6275);background:transparent;border:0;border-radius:999px;padding:7px 15px;cursor:pointer;transition:all .15s;white-space:nowrap;}' +
      '.mapa-seg button.on{background:var(--ink,#241026);color:#fff;}' +
      '.mapa-note{font-size:.8rem;color:var(--muted,#6E6275);background:rgba(255,255,255,.55);border:1px dashed var(--line,#eadfce);border-radius:9px;padding:9px 13px;margin:2px 0 20px;}' +
      '.mapa-note b{color:var(--ink,#241026);font-weight:700;}' +
      /* layout: mapa central + panel lateral */
      '.mapa-body{display:grid;grid-template-columns:1fr 546px;gap:34px;align-items:start;}' +
      '.mapa-mapwrap{justify-self:stretch;display:flex;flex-direction:column;gap:18px;}' +
      '.mapa-legend{width:400px;}' +
      '.mapa-legend .lg-title{font-family:var(--font-display,sans-serif);font-weight:700;font-size:.72rem;color:var(--purple,#5A0D74);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;}' +
      '.mapa-legend .lg-metric{color:var(--accent,#FF5A1F);}' +
      '.mapa-legend .lg-bar{height:13px;border-radius:7px;border:1px solid rgba(0,0,0,.06);}' +
      '.mapa-legend .lg-scale{display:flex;justify-content:space-between;font-size:.74rem;color:var(--muted,#6E6275);margin-top:4px;font-variant-numeric:tabular-nums;}' +
      '.mapa-svgbox{position:relative;width:400px;height:1560px;align-self:center;}' +
      '.mapa-svg{width:100%;height:100%;display:block;overflow:visible;}' +
      '.mapa-region{cursor:pointer;transition:fill .18s;}' +
      '.mapa-loading{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:var(--muted,#6E6275);font-size:.95rem;}' +
      '.mapa-tip{position:absolute;pointer-events:none;z-index:20;background:#241026;color:#fff;font-family:var(--font-body,sans-serif);font-size:.78rem;line-height:1.4;padding:8px 11px;border-radius:9px;box-shadow:0 10px 26px rgba(36,16,38,.32);white-space:nowrap;transition:opacity .12s;}' +
      '.mapa-tip .pos{color:#7FE0A6;font-weight:700;}.mapa-tip .neg{color:#F3A199;font-weight:700;}.mapa-tip i{opacity:.7;font-style:normal;}' +
      /* panel lateral sticky */
      '.mapa-detail{position:sticky;top:88px;align-self:start;max-height:calc(100vh - 110px);overflow-y:auto;background:linear-gradient(180deg,rgba(90,13,116,.05),rgba(255,90,31,.03));border:1px solid var(--line,#eadfce);border-radius:16px;padding:22px 22px;}' +
      '.mapa-dhead{border-bottom:1px solid var(--line,#eadfce);padding-bottom:15px;margin-bottom:16px;}' +
      '.mapa-pinrow{display:flex;align-items:center;gap:9px;margin-bottom:9px;}' +
      '.mapa-roman{display:inline-block;font-family:var(--font-display,sans-serif);font-weight:800;font-size:.72rem;letter-spacing:.06em;color:#fff;background:var(--purple,#5A0D74);border-radius:6px;padding:3px 10px;margin-bottom:8px;}' +
      '.mapa-pinrow .mapa-roman{margin-bottom:0;}' +
      '.mapa-pinbadge{font-family:var(--font-display,sans-serif);font-weight:700;font-size:.68rem;letter-spacing:.04em;text-transform:uppercase;color:var(--accent,#FF5A1F);}' +
      '.mapa-unpin{margin-left:auto;font-family:var(--font-display,sans-serif);font-weight:700;font-size:.74rem;color:#fff;background:var(--accent,#FF5A1F);border:0;border-radius:999px;padding:5px 14px;cursor:pointer;box-shadow:0 2px 8px rgba(255,90,31,.32);}' +
      '.mapa-unpin:hover{background:#E64D15;}' +
      '.mapa-dname{font-family:var(--font-display,sans-serif);font-weight:800;font-size:1.65rem;line-height:1.08;color:var(--ink,#241026);letter-spacing:-.015em;}' +
      '.mapa-dsub{font-size:.84rem;color:var(--muted,#6E6275);margin-top:5px;}' +
      '.mapa-dhint{font-size:.82rem;color:var(--accent,#FF5A1F);font-weight:600;margin-top:6px;}' +
      '.mapa-dnat{font-size:.84rem;color:var(--accent,#FF5A1F);font-weight:600;margin-top:6px;}' +
      '.mapa-kpis{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}' +
      '.mapa-kpi{background:#fff;border:1px solid var(--line,#eadfce);border-radius:12px;padding:13px 15px;}' +
      '.mapa-kn{font-family:var(--font-display,sans-serif);font-weight:800;font-size:1.5rem;color:var(--ink,#241026);line-height:1;font-variant-numeric:tabular-nums;}' +
      '.mapa-kn.big{font-size:1.65rem;}.mapa-kn.pos{color:#1F8A4C;}.mapa-kn.neg{color:#C0392B;}' +
      '.mapa-kl{font-size:.7rem;color:var(--muted,#6E6275);margin-top:6px;text-transform:uppercase;letter-spacing:.02em;font-weight:600;line-height:1.25;}' +
      '.mapa-sec{font-family:var(--font-display,sans-serif);font-weight:700;font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;color:var(--purple,#5A0D74);margin:4px 0 10px;}' +
      '.mapa-secmetric{color:var(--accent,#FF5A1F);}' +
      /* tabla cadenas — títulos completos (con ajuste de línea) */
      '.mapa-chead{display:grid;grid-template-columns:auto minmax(70px,1fr) repeat(4,minmax(48px,1fr));gap:9px;align-items:end;font-family:var(--font-display,sans-serif);font-weight:700;font-size:.6rem;line-height:1.15;text-transform:uppercase;letter-spacing:.02em;color:var(--muted,#6E6275);padding:0 3px 9px;border-bottom:1px solid var(--line,#eadfce);}' +
      '.mapa-chead span{text-align:right;}.mapa-chead span:nth-child(2){text-align:left;}' +
      '.mapa-crow{display:grid;grid-template-columns:auto minmax(70px,1fr) repeat(4,minmax(48px,1fr));gap:9px;align-items:center;padding:12px 3px;border-bottom:1px solid rgba(0,0,0,.05);font-size:.88rem;}' +
      '.mapa-crow:last-of-type{border-bottom:0;}' +
      '.mapa-crow.click{cursor:pointer;border-radius:9px;transition:background .13s;}' +
      '.mapa-crow.click:hover{background:rgba(90,13,116,.06);}' +
      '.mapa-cdot{width:11px;height:11px;border-radius:50%;display:inline-block;}' +
      '.mapa-cname{display:flex;align-items:center;gap:4px;font-weight:600;color:var(--ink,#241026);}' +
      '.mapa-chev{width:14px;height:14px;color:var(--muted,#6E6275);opacity:.55;flex:0 0 auto;}' +
      '.mapa-crow.click:hover .mapa-chev{color:var(--purple,#5A0D74);opacity:1;}' +
      '.mapa-cnum{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink,#241026);}' +
      '.mapa-cperf{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;}' +
      '.mapa-cup,.mapa-cdown{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;}' +
      '.mapa-cup{color:#1F8A4C;}.mapa-cdown{color:#C0392B;}' +
      '.mapa-cperf.pos{color:#1F8A4C;}.mapa-cperf.neg{color:#C0392B;}' +
      /* drill locales */
      '.mapa-back{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-display,sans-serif);font-weight:700;font-size:.78rem;color:var(--purple,#5A0D74);background:rgba(90,13,116,.10);border:1.2px solid rgba(90,13,116,.22);border-radius:999px;padding:6px 13px 6px 9px;cursor:pointer;margin-bottom:11px;}' +
      '.mapa-back:hover{background:rgba(90,13,116,.16);}.mapa-back svg{width:15px;height:15px;}' +
      '.mapa-drillname{display:flex;align-items:center;gap:9px;font-family:var(--font-display,sans-serif);font-weight:800;font-size:1.55rem;color:var(--ink,#241026);letter-spacing:-.01em;}' +
      '.mapa-drillname .mapa-cdot{width:14px;height:14px;}' +
      '.mapa-lhead{display:grid;grid-template-columns:1fr 1.4fr auto;gap:14px;font-family:var(--font-display,sans-serif);font-weight:700;font-size:.64rem;text-transform:uppercase;letter-spacing:.03em;color:var(--muted,#6E6275);padding:0 4px 9px;border-bottom:1px solid var(--line,#eadfce);}' +
      '.mapa-lhead span:nth-child(3){text-align:right;min-width:80px;}' +
      '.mapa-lrow{display:grid;grid-template-columns:1fr 1.4fr auto;gap:14px;align-items:center;padding:11px 4px;border-bottom:1px solid rgba(0,0,0,.05);font-size:.9rem;}' +
      '.mapa-lrow.click{cursor:pointer;border-radius:9px;transition:background .13s;}' +
      '.mapa-lrow.click:hover{background:rgba(90,13,116,.06);}' +
      '.mapa-lcode{font-variant-numeric:tabular-nums;font-weight:600;color:var(--purple,#5A0D74);font-size:.82rem;white-space:nowrap;}' +
      '.mapa-lname{display:flex;align-items:center;gap:5px;font-weight:600;color:var(--ink,#241026);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.mapa-lrow.click:hover .mapa-chev{color:var(--purple,#5A0D74);opacity:1;}' +
      '.mapa-lperf{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;min-width:80px;}' +
      '.mapa-lperf.pos{color:#1F8A4C;}.mapa-lperf.neg{color:#C0392B;}' +
      '.mapa-phead{display:grid;grid-template-columns:1fr 1.4fr auto;gap:14px;font-family:var(--font-display,sans-serif);font-weight:700;font-size:.64rem;text-transform:uppercase;letter-spacing:.03em;color:var(--muted,#6E6275);padding:0 4px 9px;border-bottom:1px solid var(--line,#eadfce);}' +
      '.mapa-phead span:nth-child(3){text-align:right;min-width:80px;}' +
      '.mapa-prow{display:grid;grid-template-columns:1fr 1.4fr auto;gap:14px;align-items:center;padding:11px 4px;border-bottom:1px solid rgba(0,0,0,.05);font-size:.9rem;}' +
      '.mapa-prow:last-of-type{border-bottom:0;}' +
      '.mapa-pcat{font-weight:600;color:var(--muted,#6E6275);font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.mapa-pname{font-weight:600;color:var(--ink,#241026);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.mapa-pperf{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;min-width:80px;}' +
      '.mapa-pperf.pos{color:#1F8A4C;}.mapa-pperf.neg{color:#C0392B;}' +
      '@media (max-width:1120px){.mapa-body{grid-template-columns:1fr;}.mapa-svgbox,.mapa-legend{width:340px;}.mapa-detail{position:static;max-height:none;width:100%;}}';
    var st = document.createElement('style'); st.id = 'mapa-styles'; st.textContent = css;
    document.head.appendChild(st);
  }
})();
