(function () {
  if (!window.RetailAPI || !window.RetailAPI.requireAuth()) return;

  var filtersEl = document.getElementById('filters');
  var applyBtn = document.getElementById('applyBtn');
  var clearBtn = document.getElementById('clearFiltersBtn');
  var downloadBtn = document.getElementById('downloadBtn');
  var applySummary = document.getElementById('applySummary');
  var previewTableWrap = document.getElementById('previewTableWrap');
  var previewMeta = document.getElementById('previewMeta');
  var previewNote = document.getElementById('previewNote');
  var previewSubtitle = document.getElementById('previewSubtitle');
  var options = null;

  function stripOldListeners(button) {
    var clone = button.cloneNode(true);
    button.parentNode.replaceChild(clone, button);
    return clone;
  }

  applyBtn = stripOldListeners(applyBtn);
  clearBtn = stripOldListeners(clearBtn);
  downloadBtn = stripOldListeners(downloadBtn);

  var TYPE_BY_LABEL = {
    'Góndola': 'gondola',
    'Cartelería': 'carteleria',
    'Exhibiciones': 'exhibicion',
    'Exhibiciones Adicionales': 'exhibicion-adicional'
  };

  var FILENAME_BY_TYPE = {
    'gondola': 'levantamientos-gondola-retailexperts.xlsx',
    'carteleria': 'levantamientos-carteleria-retailexperts.xlsx',
    'exhibicion': 'levantamientos-exhibiciones-retailexperts.xlsx',
    'exhibicion-adicional': 'levantamientos-exhibiciones-adicionales-retailexperts.xlsx'
  };

  var PARAM_BY_FILTER = {
    'Cadena': 'cadena',
    'Formato': 'formato',
    'Código Local': 'codigo_local',
    'Nombre Local': 'nombre_local',
    'Cliente': 'cliente',
    'Categoría': 'categoria',
    'Nombre Ciclo': 'nombre_ciclo',
    'Mueble': 'mueble'
  };

  function currentLabel() {
    var cat = document.querySelector('.cat[aria-pressed="true"]');
    return cat ? cat.textContent.trim() : 'Góndola';
  }

  function currentType() {
    return TYPE_BY_LABEL[currentLabel()] || 'gondola';
  }

  function unique(values) {
    var seen = {};
    return (values || []).filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function nomPropio(value) {
    if (value == null) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    return raw.toLocaleLowerCase('es-CL').replace(/(^|[\s([{'"\/-])([\p{L}])/gu, function (_, prefix, letter) {
      return prefix + letter.toLocaleUpperCase('es-CL');
    });
  }

  function fechaChilena(value) {
    if (value == null || value === '') return '';
    var match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(String(value).trim());
    if (!match) return String(value);
    return match[3] + '-' + match[2] + '-' + match[1];
  }

  function displayValue(key, value) {
    if (key === 'disponible' || key === 'implementado') return formatBoolean(value);
    if (key === 'fecha_levantamiento') return fechaChilena(value);
    if (key === 'cadena' || key === 'formato' || key === 'nombre_local' || key === 'cliente' || key === 'producto' || key === 'categoria_tareas' || key === 'nombre_ciclo' || key === 'mueble' || key === 'observacion') {
      return nomPropio(value);
    }
    return value == null ? '' : String(value);
  }

  function listFor(name) {
    if (!options) return [];
    if (name === 'Cadena') return unique(options.cadenas);
    if (name === 'Formato') return unique(options.formatos);
    if (name === 'Código Local') return unique(options.codigos_local);
    if (name === 'Nombre Local') return unique(options.nombres_local);
    if (name === 'Cliente') return unique(options.clientes);
    if (name === 'Categoría') return unique(options.categorias);
    if (name === 'Nombre Ciclo') return unique(options.nombres_ciclo);
    if (name === 'Mueble') return unique(options.muebles);
    return [];
  }

  function closeDropdowns() {
    document.querySelectorAll('.filter-wrap.open').forEach(function (wrap) {
      wrap.classList.remove('open');
      wrap.querySelector('.filter').setAttribute('aria-expanded', 'false');
    });
  }

  function updateSummary() {
    var active = document.querySelectorAll('.filter.has-selection').length;
    applySummary.textContent = currentLabel() + ' · ' +
      (active === 0 ? 'sin filtros adicionales' : active + (active === 1 ? ' filtro aplicado' : ' filtros aplicados'));
    if (clearBtn) clearBtn.classList.toggle('is-active', active > 0);
    if (clearBtn) clearBtn.disabled = active === 0;
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
      var list = dd.querySelector('.dd-list');
      listFor(name).forEach(function (opt) {
        var item = document.createElement('label');
        item.className = 'dd-item';
        item.innerHTML = '<input type="checkbox" value="' + escapeAttribute(opt) + '" /><span>' + escapeHtml(nomPropio(opt)) + '</span>';
        list.appendChild(item);
      });
      if (!list.children.length) {
        list.innerHTML = '<div class="dd-empty">Sin opciones</div>';
      }
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
    });

    var search = dd.querySelector('.dd-search');
    if (search) search.addEventListener('input', function () {
      var q = search.value.toLowerCase().trim();
        dd.querySelectorAll('.dd-item').forEach(function (item) {
          var match = item.textContent.toLowerCase().indexOf(q) !== -1;
          item.style.display = match ? 'flex' : 'none';
          var cb = item.querySelector('input[type="checkbox"]');
          if (!cb) return;
          if (q && match && !cb.checked) {
            cb.checked = true;
            cb.setAttribute('data-auto', '1');
          } else if (cb.getAttribute('data-auto') === '1' && (!q || !match)) {
            cb.checked = false;
            cb.removeAttribute('data-auto');
          }
        });
        dd.dispatchEvent(new Event('change'));
    });

    var clear = dd.querySelector('.dd-clear');
    if (clear) clear.addEventListener('click', function () {
      dd.querySelectorAll('input').forEach(function (input) { input.value = ''; });
      btn.classList.remove('has-selection');
      closeDropdowns();
      updateSummary();
    });

    var dateApply = dd.querySelector('.dd-apply');
    if (dateApply) dateApply.addEventListener('click', function () {
      var has = !!dd.querySelector('[data-role="start"]').value || !!dd.querySelector('[data-role="end"]').value;
      btn.classList.toggle('has-selection', has);
      closeDropdowns();
      updateSummary();
    });
  }

  function renderFilters() {
    filtersEl.querySelectorAll('.filter-wrap').forEach(function (wrap) { wrap.remove(); });
    var names = (window.CATEGORY_FILTERS && window.CATEGORY_FILTERS[currentLabel()]) ||
      ['Fecha', 'Cadena', 'Formato', 'Código Local', 'Nombre Local', 'Categoría'];
    var user = window.RetailAPI.getUser && window.RetailAPI.getUser();
    if (user && (user.rol === 'admin' || user.rol === 'interno') && names.indexOf('Cliente') === -1) {
      names = names.slice(0, 5).concat(['Cliente'], names.slice(5));
    }
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

  function clearFilters() {
    filtersEl.querySelectorAll('.filter-wrap').forEach(function (wrap) {
      wrap.querySelectorAll('input').forEach(function (input) {
        if (input.type === 'checkbox') input.checked = false;
        else input.value = '';
      });
      wrap.querySelector('.filter').classList.remove('has-selection');
    });
    closeDropdowns();
    updateSummary();
    loadPreview();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function formatBoolean(value) {
    if (value === true || value === 'true') return 'Sí';
    if (value === false || value === 'false') return 'No';
    return value == null ? '' : String(value);
  }

  var previewPager = (window.createREPager && document.getElementById('pager'))
    ? createREPager('#pager', { pageSize: 25, onChange: function () { renderPreviewPage(); }, scrollTo: '#previewPanel' })
    : null;
  var previewCache = { rows: [], columns: [] };

  function renderPreview(payload) {
    var rows = (payload && payload.rows) || [];
    var columns = (payload && payload.columns) || [];
    var total = payload && Number(payload.total || 0);
    if (previewNote) {
      previewNote.classList.toggle('is-visible', !!(payload && payload.defaultDateApplied));
    }
    if (previewSubtitle) {
      previewSubtitle.textContent = payload && payload.defaultDateApplied
        ? 'Últimos registros de ' + currentLabel() + ' de los últimos 30 días.'
        : 'Últimos registros de ' + currentLabel() + ' según los filtros seleccionados.';
    }
    if (previewMeta) {
      previewMeta.textContent = rows.length
        ? 'Mostrando ' + rows.length + ' de ' + total + ' registros'
        : 'Sin registros';
    }
    previewCache.rows = rows;
    previewCache.columns = columns;
    if (previewPager) previewPager.reset();
    renderPreviewPage();
  }

  function renderPreviewPage() {
    var rows = previewCache.rows;
    var columns = previewCache.columns;
    if (!rows.length || !columns.length) {
      if (previewPager) previewPager.slice([]);
      previewTableWrap.innerHTML = '<div class="preview-empty">No hay levantamientos para estos filtros.</div>';
      return;
    }
    var visible = previewPager ? previewPager.slice(rows) : rows;
    var html = '<table class="preview-table"><thead><tr>' +
      columns.map(function (column) { return '<th>' + escapeHtml(column.label) + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    html += visible.map(function (row) {
      return '<tr>' + columns.map(function (column) {
        var value = displayValue(column.key, row[column.key]);
        return '<td title="' + escapeAttribute(value) + '">' + escapeHtml(value) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    html += '</tbody></table>';
    previewTableWrap.innerHTML = html;
  }

  function loadOptions() {
    options = null;
    renderFilters();
    previewMeta.textContent = 'Cargando...';
    previewTableWrap.innerHTML = '<div class="preview-empty">Cargando filtros...</div>';
    return window.RetailAPI.requestJson('/web/levantamientos/' + currentType() + '/filtros')
      .then(function (payload) {
        options = payload || {};
        renderFilters();
        return loadPreview();
      })
      .catch(function () {
        previewMeta.textContent = 'Error';
        previewTableWrap.innerHTML = '<div class="preview-empty">No se pudieron cargar los filtros.</div>';
      });
  }

  function loadPreview() {
    previewMeta.textContent = 'Cargando...';
    previewTableWrap.innerHTML = '<div class="preview-empty">Cargando levantamientos...</div>';
    return window.RetailAPI.requestJson('/web/levantamientos/' + currentType() + '/preview' + window.RetailAPI.buildQuery(collectParams()))
      .then(renderPreview)
      .catch(function () {
        previewMeta.textContent = 'Error';
        previewTableWrap.innerHTML = '<div class="preview-empty">No se pudo cargar la vista previa.</div>';
      });
  }

  function downloadExcel() {
    var original = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Preparando descarga...';
    window.RetailAPI.request('/web/levantamientos/' + currentType() + '.xlsx' + window.RetailAPI.buildQuery(collectParams()))
      .then(function (response) { return response.blob(); })
      .then(function (blob) {
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = FILENAME_BY_TYPE[currentType()] || 'levantamientos-retailexperts.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .finally(function () {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = original;
      });
  }

  document.addEventListener('click', closeDropdowns);
  document.querySelectorAll('.cat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.setTimeout(loadOptions, 0);
    });
  });
  applyBtn.addEventListener('click', loadPreview);
  clearBtn.addEventListener('click', clearFilters);
  downloadBtn.addEventListener('click', downloadExcel);

  loadOptions();
})();
