(function () {
  'use strict';

  var weeks = ['06 abr', '13 abr', '20 abr', '27 abr', '04 may', '11 may', '18 may', '25 may', '01 jun', '08 jun', '15 jun', '22 jun', '29 jun'];
  var months = ['Jul 25', 'Ago 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dic 25', 'Ene 26', 'Feb 26', 'Mar 26', 'Abr 26', 'May 26', 'Jun 26'];
  var chains = [
    { name: 'Cencosud', format: 'Jumbo', region: 'R. Metropolitana', prefix: 'J' },
    { name: 'Walmart', format: 'Hiper Lider', region: 'R. Metropolitana', prefix: 'L' },
    { name: 'SMU', format: 'Unimarc', region: 'Valparaiso', prefix: 'U' },
    { name: 'Tottus', format: 'Hiper Tottus', region: 'Biobio', prefix: 'T' }
  ];
  var productNames = ['Aceite 1L', 'Detergente 3kg', 'Cafe 250g', 'Shampoo 400ml', 'Galletas 140g', 'Atun 170g', 'Arroz 1kg', 'Jugo 1.5L'];
  var categories = ['Alimentos', 'Limpieza', 'Bebidas', 'Cuidado Personal'];
  var brands = ['Olisur', 'Adclean', 'Cafe Haiti', 'Bekys'];

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function series(seed, base, spread) {
    var out = [];
    for (var i = 0; i < weeks.length; i += 1) {
      var wave = Math.sin((i + (seed % 5)) / 2.2) * spread * 0.35;
      var noise = ((hash(seed + ':' + i) % 1000) / 1000 - 0.5) * spread;
      out.push(Math.round(Math.max(base * 0.55, base + wave + noise + i * base * 0.012)));
    }
    return out;
  }

  var locales = [];
  chains.forEach(function (chain, ci) {
    for (var i = 0; i < 3; i += 1) {
      var seed = hash(chain.name + i);
      var vp = 78000000 + ci * 13500000 + i * 7200000;
      locales.push({
        cad: chain.name,
        fmt: chain.format,
        region: chain.region,
        cod: chain.prefix + (101 + i),
        nom: chain.format + ' ' + ['Centro', 'Norte', 'Oriente'][i],
        categoria: categories[(ci + i) % categories.length],
        marca: brands[(ci * 2 + i) % brands.length],
        codprod: 'SKU' + (1001 + ci * 3 + i),
        descriptor: productNames[(ci * 2 + i) % productNames.length],
        vp: vp,
        vc: Math.round(vp * (0.61 + (seed % 8) / 100)),
        vu: Math.round(vp / (3600 + seed % 900)),
        vpLy: Math.round(vp * (0.86 + (seed % 9) / 100)),
        vcLy: Math.round(vp * 0.59),
        vuLy: Math.round(vp / 4300),
        mVp: Math.round(vp * (1.04 + (seed % 7) / 100)),
        mVc: Math.round(vp * 0.66),
        mVu: Math.round(vp / 3800),
        osa: 86 + (seed % 110) / 10,
        ins: 89 + (seed % 95) / 10,
        doh: 17 + (seed % 170) / 10,
        qb: 1.2 + (seed % 55) / 10
      });
    }
  });

  function groupCommercial(key) {
    var map = {};
    locales.forEach(function (local) {
      var label = local[key];
      if (!map[label]) map[label] = { label: label, vp: 0, vc: 0, vu: 0, ly: 0, meta: 0 };
      map[label].vp += local.vp;
      map[label].vc += local.vc;
      map[label].vu += local.vu;
      map[label].ly += local.vpLy;
      map[label].meta += local.mVp;
    });
    return {
      values: Object.keys(map).map(function (label) {
        var row = map[label];
        var seed = hash(label);
        return {
          label: label,
          pesos: series(seed, row.vp / weeks.length, row.vp / weeks.length * 0.18),
          costo: series(seed + 7, row.vc / weeks.length, row.vc / weeks.length * 0.15),
          unidades: series(seed + 13, row.vu / weeks.length, row.vu / weeks.length * 0.12),
          ly: row.ly,
          meta: row.meta
        };
      })
    };
  }

  var aperturas = {
    cadena: groupCommercial('cad'),
    formato: groupCommercial('fmt'),
    region: groupCommercial('region'),
    codlocal: groupCommercial('cod'),
    nomlocal: groupCommercial('nom'),
    categoria: groupCommercial('categoria'),
    marca: groupCommercial('marca'),
    codprod: groupCommercial('codprod'),
    descriptor: groupCommercial('descriptor')
  };

  var cadenas = chains.map(function (chain) {
    var rows = locales.filter(function (local) { return local.cad === chain.name; });
    return {
      cadena: chain.name,
      vp: rows.reduce(function (sum, row) { return sum + row.vp; }, 0),
      vu: rows.reduce(function (sum, row) { return sum + row.vu; }, 0)
    };
  });
  var totalVp = locales.reduce(function (sum, row) { return sum + row.vp; }, 0);
  var totalVu = locales.reduce(function (sum, row) { return sum + row.vu; }, 0);

  window.DASH_DEMO = {
    weeks: weeks,
    comercial: { aperturas: aperturas },
    resumen: {
      locales: locales,
      monthLabels: months,
      mPesos: series(81, totalVp * 0.82, totalVp * 0.09).slice(1),
      mUnidades: series(91, totalVu * 0.82, totalVu * 0.08).slice(1),
      cadenaResumen: cadenas
    },
    abastecimiento: {
      lineInstock: [91.2, 92.1, 91.8, 93.0, 92.7, 93.6, 94.1, 93.8, 94.5, 95.0, 94.7, 95.4, 95.8]
    },
    forecast: {
      lineForecast: series(101, totalVp / 13 * 1.08, totalVp / 13 * 0.10),
      lineReal: series(111, totalVp / 13, totalVp / 13 * 0.10),
      matriz: cadenas.map(function (row, i) {
        var forecast = Math.round(row.vp * (1.06 + i * 0.015));
        return { cadena: row.cadena, fc: forecast, real: row.vp, perdida: Math.max(0, forecast - row.vp) };
      })
    }
  };
})();
