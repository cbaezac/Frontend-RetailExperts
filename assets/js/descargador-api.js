(function () {
  if (!window.RetailAPI || !window.RetailAPI.requireAuth()) return;

  var filtersEl = document.getElementById('filters');
  var applyBtn = document.getElementById('applyBtn');
  var applySummary = document.getElementById('applySummary');
  var previewPanel = document.getElementById('previewPanel');
  var previewTableWrap = document.getElementById('previewTableWrap');
  var previewMeta = document.getElementById('previewMeta');
  var previewNote = document.getElementById('previewNote');
  var previewSubtitle = document.getElementById('previewSubtitle');
  var options = null;
  var previewTimer = null;

  var applyClone = applyBtn.cloneNode(true);
  applyBtn.parentNode.replaceChild(applyClone, applyBtn);
  applyBtn = applyClone;

  var PARAM_BY_FILTER = {
    'Cadena': 'cadena',
    'Formato': 'formato',
    'Código Local': 'codigo_local',
    'Nombre Local': 'nombre_local',
    'Categoría': 'categoria'
  };

  function currentLabel() {
    var cat = document.querySelector('.cat[aria-pressed="true"]');
    return cat ? cat.textContent.trim() : 'Góndola';
  }

  function unique(values) {
    var seen = {};
    return (values || []).filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function listFor(name) {
    if (!options) return [];
    if (name === 'Cadena') return unique(options.cadenas);
    if (name === 'Formato') return unique(options.formatos);
    if (name === 'Código Local') return unique(options.codigos_local);
    if (name === 'Nombre Local') return unique(options.nombres_local);
    if (name === 'Categoría') return unique(options.categorias);
    return [];
  }

  function closeDropdowns() {
    document.querySelectorAll('.filter-wrap.open').forEach(function (wrap) {
      wrap.classList.remove('open');
      wrap.querySelector('.filter').setAttribute('aria-expanded', 'false');
    });
  }

  function updateSummary() {
    var isGondola = currentLabel() === 'Góndola';
    var active = document.querySelectorAll('.filter.has-selection').length;
    applySummary.textContent = currentLabel() + ' · ' + (
      isGondola
        ? (active === 0 ? 'sin filtros adicionales' : active + (active === 1 ? ' filtro aplicado' : ' filtros aplicados'))
        : 'próximamente'
    );
    applyBtn.disabled = !isGondola;
    if (previewPanel) previewPanel.style.display = isGondola ? '' : 'none';
  }

  function buildFilter(name) {
    var wrap = document.createElement('div');
    wrap.className = 'filter-wrap';
    wrap.setAttribute('data-filter', name);
    var btn = document.createElement('button');
    btn.className = 'filter';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="fname">' + name + '</span><span class="chev" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    var dd = document.createElement('div');
    dd.className = 'dropdown';

    if (name === 'Fecha') {
      dd.classList.add('dropdown-date');
      dd.innerHTML = '<div class="dd-field"><label>Fecha de inicio</label><input type="date" class="dd-date" data-role="start" /></div><div class="dd-field"><label>Fecha de término</label><input type="date" class="dd-date" data-role="end" /></div><div class="dd-actions"><button type="button" class="dd-clear">Limpiar</button><button type="button" class="dd-apply">Aplicar</button></div>';
    } else {
      dd.innerHTML = '<input class="dd-search" type="text" placeholder="Buscar ' + name.toLowerCase() + '..." /><div class="dd-list"></div>';
      listFor(name).forEach(function (opt) {
        var item = document.createElement('label');
        item.className = 'dd-item';
        item.innerHTML = '<input type="checkbox" value="' + opt.replace(/"/g, '&quot;') + '" /><span>' + opt + '</span>';
        dd.querySelector('.dd-list').appendChild(item);
      });
    }

    wrap.appendChild(btn);
    wrap.appendChild(dd);
    filtersEl.appendChild(wrap);
    btn.addEventListener('click', function (event) {
      event.stopPropagation();
      var open = wrap.classList.contains('open');
      closeDropdowns();
      if (!open) {
        wrap.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    dd.addEventListener('click', function (event) { event.stopPropagation(); });
    dd.addEventListener('change', function () {
      var has = dd.querySelectorAll('input[type="checkbox"]:checked').length > 0;
      btn.classList.toggle('has-selection', has);
      updateSummary();
      schedulePreview();
    });
    var search = dd.querySelector('.dd-search');
    if (search) search.addEventListener('input', function () {
      var q = search.value.toLowerCase();
      dd.querySelectorAll('.dd-item').forEach(function (item) {
        item.style.display = item.textContent.toLowerCase().indexOf(q) === -1 ? 'none' : 'flex';
      });
    });
    var clear = dd.querySelector('.dd-clear');
    if (clear) clear.addEventListener('click', function () {
      dd.querySelectorAll('input').forEach(function (input) { input.value = ''; });
      btn.classList.remove('has-selection');
      closeDropdowns();
      updateSummary();
      schedulePreview();
    });
    var dateApply = dd.querySelector('.dd-apply');
    if (dateApply) dateApply.addEventListener('click', function () {
      var has = !!dd.querySelector('[data-role="start"]').value || !!dd.querySelector('[data-role="end"]').value;
      btn.classList.toggle('has-selection', has);
      closeDropdowns();
      updateSummary();
      schedulePreview();
    });
  }

  function renderFilters() {
    filtersEl.querySelectorAll('.filter-wrap').forEach(function (wrap) { wrap.remove(); });
    var names = (window.CATEGORY_FILTERS && window.CATEGORY_FILTERS[currentLabel()]) ||
      ['Fecha', 'Cadena', 'Formato', 'Código Local', 'Nombre Local', 'Categoría'];
    names.forEach(buildFilter);
    updateSummary();
  }

  function collectParams() {
    var params = {};
    var start = filtersEl.querySelector('[data-filter="Fecha"] [data-role="start"]');
    var end = filtersEl.querySelector('[data-filter="Fecha"] [data-role="end"]');
    if (start && start.value) params.fecha_desde = start.value;
    if (end && end.value) params.fecha_hasta = end.value;
    Object.keys(PARAM_BY_FILTER).forEach(function (name) {
      var wrap = filtersEl.querySelector('[data-filter="' + name + '"]');
      if (!wrap) return;
      var values = Array.prototype.slice.call(wrap.querySelectorAll('input[type="checkbox"]:checked')).map(function (input) {
        return input.value;
      });
      if (values.length) params[PARAM_BY_FILTER[name]] = values;
    });
    return params;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBoolean(value) {
    if (value === true || value === 'true') return 'Sí';
    if (value === false || value === 'false') return 'No';
    return value == null ? '' : String(value);
  }

  function renderPreview(payload) {
    if (!previewTableWrap) return;
    var rows = (payload && payload.rows) || [];
    var total = payload && Number(payload.total || 0);
    if (previewNote) {
      previewNote.classList.toggle('is-visible', !!(payload && payload.defaultDateApplied));
    }
    if (previewSubtitle) {
      previewSubtitle.textContent = payload && payload.defaultDateApplied
        ? 'Últimos registros de Góndola de los últimos 30 días.'
        : 'Últimos registros de Góndola según los filtros seleccionados.';
    }
    if (previewMeta) {
      previewMeta.textContent = rows.length
        ? 'Mostrando ' + rows.length + ' de ' + total + ' registros'
        : 'Sin registros';
    }
    if (!rows.length) {
      previewTableWrap.innerHTML = '<div class="preview-empty">No hay levantamientos para estos filtros.</div>';
      return;
    }
    var headers = [
      ['fecha_ejecucion', 'Fecha ejecución'],
      ['cadena', 'Cadena'],
      ['formato', 'Formato'],
      ['id_local', 'Código local'],
      ['nombre_local', 'Nombre local'],
      ['id_producto', 'ID producto'],
      ['categoria_tareas', 'Categoría'],
      ['disponible', 'Disponible'],
      ['observacion', 'Observación']
    ];
    var html = '<table class="preview-table"><thead><tr>' +
      headers.map(function (h) { return '<th>' + h[1] + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    html += rows.map(function (row) {
      return '<tr>' + headers.map(function (h) {
        var value = h[0] === 'disponible' ? formatBoolean(row[h[0]]) : row[h[0]];
        return '<td title="' + escapeHtml(value) + '">' + escapeHtml(value) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    html += '</tbody></table>';
    previewTableWrap.innerHTML = html;
  }

  function loadPreview() {
    if (currentLabel() !== 'Góndola' || !previewTableWrap) return;
    previewMeta.textContent = 'Cargando...';
    previewTableWrap.innerHTML = '<div class="preview-empty">Cargando levantamientos...</div>';
    window.RetailAPI.requestJson('/web/levantamientos/gondola/preview' + window.RetailAPI.buildQuery(collectParams()))
      .then(renderPreview)
      .catch(function () {
        if (previewMeta) previewMeta.textContent = 'Error';
        previewTableWrap.innerHTML = '<div class="preview-empty">No se pudo cargar la vista previa.</div>';
      });
  }

  function schedulePreview() {
    if (previewTimer) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(loadPreview, 250);
  }

  document.addEventListener('click', closeDropdowns);
  document.querySelectorAll('.cat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.setTimeout(function () {
        renderFilters();
        schedulePreview();
      }, 0);
    });
  });
  applyBtn.addEventListener('click', function () {
    if (currentLabel() !== 'Góndola') return;
    var original = applyBtn.innerHTML;
    applyBtn.disabled = true;
    applyBtn.textContent = 'Preparando descarga...';
    window.RetailAPI.request('/web/levantamientos/gondola.csv' + window.RetailAPI.buildQuery(collectParams()))
      .then(function (response) { return response.blob(); })
      .then(function (blob) {
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = 'levantamientos-gondola-retailexperts.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .finally(function () {
        applyBtn.disabled = false;
        applyBtn.innerHTML = original;
      });
  });

  window.RetailAPI.requestJson('/web/levantamientos/gondola/filtros')
    .then(function (payload) {
      options = payload || {};
      renderFilters();
      loadPreview();
    });
})();
