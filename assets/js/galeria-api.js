(function () {
  if (!window.RetailAPI || !window.RetailAPI.requireAuth()) return;

  // ---- MODO VISTA PREVIA (solo entorno de diseño, no afecta prod/Netlify) ----
  var IS_PREVIEW = /claudeusercontent\.com$/.test(window.location.hostname);
  var PREVIEW_FILTERS = {
    cadenas: ['Walmart', 'Cencosud', 'Tottus', 'SMU'],
    formatos: ['Hipermercado', 'Supermercado', 'Express'],
    codigos_local: ['L-1042', 'L-2088', 'L-3117'],
    regiones: ['Metropolitana', 'Valparaíso', 'Biobío'],
    nombres_local: ['Lider Maipú', 'Jumbo Kennedy', 'Tottus Puente Alto'],
    clientes: ['Cliente Demo A', 'Cliente Demo B'],
    rutas: ['Ruta Norte', 'Ruta Centro', 'Ruta Sur'],
    categorias: ['Juguetes', 'Bebidas', 'Abarrotes']
  };
  function previewPhotoUrl(i) {
    var tones = [['#EFE3C4', '#E7D8B2'], ['#EAD9C0', '#E0CBA9'], ['#E6E0C8', '#DBD2B0']];
    var t = tones[i % tones.length];
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='520'>" +
      "<defs><pattern id='s' width='14' height='14' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>" +
      "<rect width='14' height='14' fill='" + t[0] + "'/><rect width='7' height='14' fill='" + t[1] + "'/></pattern></defs>" +
      "<rect width='100%' height='100%' fill='url(%23s)'/>" +
      "<text x='50%' y='50%' text-anchor='middle' font-family='monospace' font-size='22' fill='#6B6557'>foto " + (i + 1) + "</text>" +
      "</svg>";
    return 'data:image/svg+xml,' + svg.replace(/#/g, '%23');
  }
  function previewPhotos() {
    var list = [];
    for (var i = 0; i < 12; i++) {
      list.push({
        id_foto: 'demo-' + (i + 1),
        url: previewPhotoUrl(i),
        ruta_archivo: 'demo/foto-' + (i + 1) + '.jpg',
        cadena: PREVIEW_FILTERS.cadenas[i % 4],
        formato: PREVIEW_FILTERS.formatos[i % 3],
        codigo_local: PREVIEW_FILTERS.codigos_local[i % 3],
        nombre_local: PREVIEW_FILTERS.nombres_local[i % 3],
        creado_en: '2026-06-' + String(10 + i) + 'T' + ('0' + (9 + (i % 8))).slice(-2) + ':' + ('0' + ((i * 7) % 60)).slice(-2) + ':00',
        fecha: '2026-06-' + String(10 + i)
      });
    }
    return list;
  }
  // ---------------------------------------------------------------------------

  var TYPE_BY_LABEL = {
    'Góndola': 'gondola',
    'Cartelería': 'carteleria',
    'Exhibiciones': 'exhibicion',
    'Espacios Adicionales': 'exhibicion_adicional'
  };
  var PARAM_BY_FILTER = {
    'Cadena': 'cadena',
    'Formato': 'formato',
    'Región': 'region',
    'Código Local': 'codigo_local',
    'Nombre Local': 'nombre_local',
    'Cliente': 'cliente',
    'Ruta': 'ruta',
    'Categoría': 'categoria',
    'Nombre Ciclo': 'nombre_ciclo',
    'Mueble': 'mueble'
  };

  var gallery = document.getElementById('gallery');
  var filtersEl = document.getElementById('filters');
  var applyBtn = document.getElementById('applyBtn');
  var selectAll = document.getElementById('selectAll');
  var downloadBtn = document.getElementById('downloadBtn');
  var dlLabel = document.getElementById('dlLabel');
  var selCount = document.getElementById('selCount');
  var photos = [];
  var selected = {};
  var filterOptions = null;
  var currentPage = 1;
  var pageSize = 100;
  var totalPhotos = 0;
  var isLoading = false;
  var currentLightboxPhoto = null;

  function clearOldHandlers(element) {
    var clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    return clone;
  }

  applyBtn = clearOldHandlers(applyBtn);
  selectAll = clearOldHandlers(selectAll);
  downloadBtn = clearOldHandlers(downloadBtn);
  dlLabel = document.getElementById('dlLabel');

  var style = document.createElement('style');
  style.textContent = '.photo img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.photo-meta{display:flex;padding:8px 10px;background:#FFFDF6;border-top:1.5px solid rgba(28,26,20,.14);text-align:left}.photo-meta-main{display:flex;flex-direction:column;gap:2px;font:700 12px/1.4 Manrope,sans-serif;color:#1C1A14;letter-spacing:.01em;min-width:0;width:100%}.photo-meta-main span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}.photo-meta-date{font-weight:600;color:#6B6557}.photo-expand{position:absolute;left:10px;top:10px;z-index:3;width:36px;height:36px;border-radius:10px;border:0;background:rgba(26,25,22,.85);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 18px rgba(0,0,0,.25);transition:transform .18s ease,background .18s ease}.photo-expand:hover{background:#33312b;transform:translateY(-1px)}.photo-expand svg{width:19px;height:19px}.gallery-empty{grid-column:1/-1;padding:48px 18px;text-align:center;color:rgba(28,26,20,.58);font-weight:700}.gallery-loading{grid-column:1/-1;padding:48px 18px;text-align:center;color:rgba(28,26,20,.62);font-weight:700}.gallery-pager{display:flex;align-items:center;justify-content:center;gap:16px;margin:34px 0 6px;flex-wrap:wrap}.gallery-pager-info{font:700 14px Inter,sans-serif;color:rgba(28,26,20,.64)}.gallery-load-more{border:0;border-radius:999px;background:#11100b;color:#fff8e7;font:800 15px Inter,sans-serif;padding:14px 28px;cursor:pointer;box-shadow:0 14px 30px rgba(28,26,20,.18)}.gallery-load-more:hover{transform:translateY(-1px)}.gallery-load-more:disabled{opacity:.45;cursor:not-allowed;transform:none}.btn-clear-filters{border:0;border-radius:999px;padding:13px 22px;font:800 14px Inter,sans-serif;background:rgba(28,26,20,.08);color:rgba(28,26,20,.54);cursor:pointer}.btn-clear-filters.active{background:#e0561c;color:#fff8e7;box-shadow:0 12px 26px rgba(224,86,28,.26)}.photo-lightbox{position:fixed;inset:0;z-index:9999;background:rgba(16,14,10,.88);display:none;align-items:center;justify-content:center;padding:28px}.photo-lightbox.open{display:flex}.photo-lightbox-dialog{position:relative;width:min(1180px,96vw);max-height:94vh;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px}.photo-lightbox-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff8e7;font:700 13px Inter,sans-serif}.photo-lightbox-meta{padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.58);overflow-wrap:anywhere}.photo-lightbox-close{border:0;border-radius:50%;width:42px;height:42px;background:#fff8e7;color:#11100b;font:900 22px Inter,sans-serif;cursor:pointer}.photo-lightbox img{max-width:100%;max-height:calc(94vh - 76px);object-fit:contain;justify-self:center;align-self:center;border-radius:4px;box-shadow:0 22px 60px rgba(0,0,0,.38)}';
  document.head.appendChild(style);

  var clearFiltersBtn = document.createElement('button');
  clearFiltersBtn.className = 'btn-clear-filters';
  clearFiltersBtn.type = 'button';
  clearFiltersBtn.textContent = 'Quitar filtros';
  applyBtn.insertAdjacentElement('afterend', clearFiltersBtn);

  var lightbox = document.createElement('div');
  lightbox.className = 'photo-lightbox';
  lightbox.innerHTML =
    '<div class="photo-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Fotografía ampliada">' +
      '<div class="photo-lightbox-toolbar">' +
        '<div class="photo-lightbox-meta" id="photoLightboxMeta"></div>' +
        '<button class="photo-lightbox-close" type="button" aria-label="Cerrar">×</button>' +
      '</div>' +
      '<img id="photoLightboxImage" alt="Fotografía ampliada">' +
    '</div>';
  document.body.appendChild(lightbox);
  var lightboxImage = document.getElementById('photoLightboxImage');
  var lightboxMeta = document.getElementById('photoLightboxMeta');

  var pagerHost = document.createElement('div');
  pagerHost.id = 'galleryPager';
  gallery.insertAdjacentElement('afterend', pagerHost);
  var gPager = window.createREPager
    ? createREPager(pagerHost, { pageSize: pageSize, onChange: function (p) { currentPage = p + 1; loadPhotos({ keepPage: true }); }, scrollTo: gallery })
    : null;

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
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (raw.toLocaleLowerCase('es-CL') === 'smu') return 'SMU';
    return raw.toLocaleLowerCase('es-CL').replace(/(^|[\s([{'"\/-])([\p{L}])/gu, function (_, prefix, letter) {
      return prefix + letter.toLocaleUpperCase('es-CL');
    });
  }

  function displayValue(key, value) {
    if (value == null || value === '') return '';
    if (key === 'codigo_local' || key === 'id_local' || key === 'id_foto') return String(value);
    if (key === 'cadena' || key === 'formato' || key === 'region' || key === 'nombre_local' || key === 'cliente' || key === 'clientes' || key === 'ruta' || key === 'categoria' || key === 'nombre_ciclo' || key === 'mueble') {
      return nomPropio(value);
    }
    return String(value);
  }

  function displayFilterValue(name, value) {
    return displayValue(PARAM_BY_FILTER[name] || name, value);
  }

  function optionsFor(name) {
    if (!filterOptions) return [];
    if (name === 'Cadena') return unique(filterOptions.cadenas);
    if (name === 'Formato') return unique(filterOptions.formatos);
    if (name === 'Región') return unique(filterOptions.regiones);
    if (name === 'Código Local') return unique(filterOptions.codigos_local);
    if (name === 'Nombre Local') return unique(filterOptions.nombres_local);
    if (name === 'Cliente') return unique(filterOptions.clientes);
    if (name === 'Ruta') return unique(filterOptions.rutas);
    if (name === 'Nombre Ciclo') return unique(filterOptions.nombres_ciclo);
    if (name === 'Mueble') return unique(filterOptions.muebles);
    return unique(filterOptions.categorias);
  }

  function selectedValues(name) {
    var wrap = filtersEl.querySelector('[data-filter="' + name + '"]');
    if (!wrap) return [];
    return Array.prototype.slice.call(wrap.querySelectorAll('input[type="checkbox"]:checked'))
      .map(function (input) { return input.value; });
  }

  function selectedDate(role) {
    var input = filtersEl.querySelector('[data-filter="Fecha"] [data-role="' + role + '"]');
    return input ? input.value : '';
  }

  function collectParams() {
    var params = { tipo: currentType(), page: currentPage, limit: pageSize };
    var start = selectedDate('start');
    var end = selectedDate('end');
    if (start) params.fecha_desde = start;
    if (end) params.fecha_hasta = end;

    Object.keys(PARAM_BY_FILTER).forEach(function (name) {
      var values = selectedValues(name);
      if (values.length) params[PARAM_BY_FILTER[name]] = values;
    });
    return params;
  }

  function updateSelection() {
    var count = Object.keys(selected).length;
    if (!count) {
      selCount.textContent = 'Ninguna fotografía seleccionada';
      downloadBtn.classList.remove('active');
      dlLabel.textContent = 'Descargar';
    } else {
      selCount.textContent = count + (count === 1 ? ' fotografía seleccionada' : ' fotografías seleccionadas');
      downloadBtn.classList.add('active');
      dlLabel.textContent = 'Descargar (' + count + ')';
    }
    selectAll.textContent = count && count === photos.length ? 'Quitar selección' : 'Seleccionar todo';
  }

  function isPrivilegedUser() {
    var user = window.RetailAPI.getUser && window.RetailAPI.getUser();
    return !!user && (user.rol === 'admin' || user.rol === 'interno');
  }

  function hasActiveFilters() {
    return Array.prototype.some.call(filtersEl.querySelectorAll('.filter-wrap'), function (wrap) {
      return wrap.querySelectorAll('input[type="checkbox"]:checked').length > 0 ||
        Array.prototype.some.call(wrap.querySelectorAll('input[type="date"]'), function (input) { return !!input.value; });
    });
  }

  function updateClearFiltersButton() {
    clearFiltersBtn.classList.toggle('active', hasActiveFilters());
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPhotoDate(value) {
    if (!value) return '';
    var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[3] + '-' + match[2] + '-' + match[1];
    return String(value);
  }

  function formatPhotoDateTime(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatPhotoDate(value);
    var parts = new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'America/Santiago'
    }).formatToParts(date).reduce(function (acc, part) {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return parts.day + '-' + parts.month + '-' + parts.year + ' - ' + parts.hour + ':' + parts.minute;
  }

  function fileSafeSegment(value, fallback) {
    var text = String(value || fallback || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return text || fallback || 'sin-dato';
  }

  function updatePager() {
    if (gPager) gPager.setTotal(totalPhotos);
  }

  function renderPhotos(items, append) {
    var newPhotos = items || [];
    if (!append) {
      photos = [];
      selected = {};
      gallery.innerHTML = '';
    }
    if (!newPhotos.length && !photos.length) {
      gallery.innerHTML = '<div class="gallery-empty">No hay fotografías para estos filtros.</div>';
      updateSelection();
      updatePager();
      return;
    }

    newPhotos.forEach(function (photo) {
      var id = String(photo.id_foto || photo.id);
      var rutaArchivo = photo.ruta_archivo || '';
      var formattedDate = formatPhotoDateTime(photo.creado_en) || formatPhotoDate(photo.fecha);
      var metaLine1 = [displayValue('formato', photo.formato), displayValue('codigo_local', photo.codigo_local || photo.id_local)].filter(Boolean).join(' · ');
      var metaLine2 = displayValue('nombre_local', photo.nombre_local);
      photos.push(photo);
      var card = document.createElement('div');
      card.className = 'photo';
      card.setAttribute('aria-selected', 'false');
      card.setAttribute('data-foto-id', id);
      card.setAttribute('data-ruta-archivo', rutaArchivo);
      card.innerHTML =
        '<img src="' + escapeHtml(photo.url) + '" alt="Fotografía ' + escapeHtml(id) + '" loading="lazy">' +
        '<div class="photo-meta">' +
          '<span class="photo-meta-main">' +
            (metaLine1 ? '<span>' + escapeHtml(metaLine1) + '</span>' : '') +
            (metaLine2 ? '<span>' + escapeHtml(metaLine2) + '</span>' : '') +
            (formattedDate ? '<span class="photo-meta-date">' + escapeHtml(formattedDate) + '</span>' : '') +
          '</span>' +
        '</div>' +
        '<button class="photo-expand" type="button" aria-label="Ampliar foto">' +
          '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 15.5 4 20m0 0h5.8M4 20v-5.8M15.5 8.5 20 4m0 0h-5.8M20 4v5.8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
        '<div class="check"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#FFF8E7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
      card.querySelector('.photo-expand').addEventListener('click', function (event) {
        event.stopPropagation();
        openLightbox(photo);
      });
      card.addEventListener('click', function () {
        if (selected[id]) delete selected[id];
        else selected[id] = photo;
        card.setAttribute('aria-selected', selected[id] ? 'true' : 'false');
        updateSelection();
      });
      gallery.appendChild(card);
    });
    updateSelection();
    updatePager();
  }

  function loadPhotos(options) {
    options = options || {};
    if (isLoading) return Promise.resolve();
    isLoading = true;
    if (!options.keepPage) {
      currentPage = 1;
      totalPhotos = 0;
      if (gPager) gPager.reset();
    }
    gallery.innerHTML = '<div class="gallery-loading">Cargando fotografías...</div>';
    updatePager();
    return window.RetailAPI.requestJson('/web/galeria/fotos' + window.RetailAPI.buildQuery(collectParams()))
      .then(function (payload) {
        totalPhotos = Number(payload.total || 0);
        renderPhotos(payload.fotos || payload.data || [], false);
      })
      .catch(function () {
        if (IS_PREVIEW) {
          totalPhotos = 12;
          renderPhotos(previewPhotos(), false);
        } else {
          gallery.innerHTML = '<div class="gallery-empty">No se pudieron cargar las fotografías.</div>';
        }
      })
      .finally(function () {
        isLoading = false;
        updatePager();
      });
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
      optionsFor(name).forEach(function (opt) {
        var item = document.createElement('label');
        item.className = 'dd-item';
        item.innerHTML = '<input type="checkbox" value="' + escapeHtml(opt) + '" /><span>' + escapeHtml(displayFilterValue(name, opt)) + '</span>';
        dd.querySelector('.dd-list').appendChild(item);
      });
    }

    wrap.appendChild(btn);
    wrap.appendChild(dd);
    filtersEl.appendChild(wrap);

    btn.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = wrap.classList.contains('open');
      closeDropdowns();
      if (!isOpen) {
        wrap.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    dd.addEventListener('click', function (event) { event.stopPropagation(); });
    dd.addEventListener('change', function (event) {
      if (event.target && event.target.matches && event.target.matches('input[type="checkbox"]')) event.target.removeAttribute('data-auto');
      var count = dd.querySelectorAll('input[type="checkbox"]:checked').length;
      btn.classList.toggle('has-selection', count > 0);
      updateClearFiltersButton();
    });
    var search = dd.querySelector('.dd-search');
    if (search) {
      search.addEventListener('input', function () {
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
    }
    var clear = dd.querySelector('.dd-clear');
    if (clear) clear.addEventListener('click', function () {
      dd.querySelectorAll('input').forEach(function (input) { input.value = ''; });
      btn.classList.remove('has-selection');
      closeDropdowns();
      updateClearFiltersButton();
    });
    var dateApply = dd.querySelector('.dd-apply');
    if (dateApply) dateApply.addEventListener('click', function () {
      btn.classList.toggle('has-selection', !!selectedDate('start') || !!selectedDate('end'));
      closeDropdowns();
      updateClearFiltersButton();
    });
  }

  function closeDropdowns() {
    document.querySelectorAll('.filter-wrap.open').forEach(function (wrap) {
      wrap.classList.remove('open');
      wrap.querySelector('.filter').setAttribute('aria-expanded', 'false');
    });
  }

  function renderFilters() {
    filtersEl.querySelectorAll('.filter-wrap').forEach(function (wrap) { wrap.remove(); });
    var names = (window.CATEGORY_FILTERS && window.CATEGORY_FILTERS[currentLabel()]) ||
      ['Fecha', 'Cadena', 'Formato', 'Región', 'Código Local', 'Nombre Local', 'Categoría'];
    if (isPrivilegedUser()) names = names.concat(['Cliente', 'Ruta']);
    names.forEach(buildFilter);
    applyUrlFilters();
    updateClearFiltersButton();
  }

  /* Preselección de filtros vía URL (enlace desde Dashboards) */
  var URL_FILTER_BY_PARAM = {
    cadena: 'Cadena',
    formato: 'Formato',
    region: 'Región',
    codigo_local: 'Código Local',
    nombre_local: 'Nombre Local'
  };
  function applyUrlFilters() {
    var qs;
    try { qs = new URLSearchParams(window.location.search); } catch (_) { return; }
    var noEncontrados = [];
    Object.keys(URL_FILTER_BY_PARAM).forEach(function (param) {
      var raw = qs.get(param);
      if (!raw) return;
      var wanted = raw.split('||').map(function (v) { return v.trim().toLowerCase(); }).filter(Boolean);
      if (!wanted.length) return;
      var wrap = filtersEl.querySelector('[data-filter="' + URL_FILTER_BY_PARAM[param] + '"]');
      if (!wrap) return;
      var hit = 0;
      wrap.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        var v = String(cb.value).toLowerCase();
        var match = wanted.some(function (w) { return v === w || v.indexOf(w) !== -1 || w.indexOf(v) !== -1; });
        if (match && !cb.checked) { cb.checked = true; hit++; }
      });
      if (hit) {
        var dd = wrap.querySelector('.dropdown') || wrap;
        dd.dispatchEvent(new Event('change'));
      } else {
        noEncontrados.push(URL_FILTER_BY_PARAM[param] + ' \u00b7 ' + raw.split('||').join(', '));
      }
    });
    var prev = document.getElementById('galUrlWarn');
    if (prev) prev.remove();
    if (noEncontrados.length) {
      var warn = document.createElement('div');
      warn.id = 'galUrlWarn';
      warn.style.cssText = 'margin:0 0 18px;padding:12px 16px;border:1.5px dashed rgba(194,58,43,.5);border-radius:12px;background:rgba(194,58,43,.07);color:#8f2f24;font:600 .9rem Manrope,sans-serif;text-align:center;';
      warn.textContent = 'Ojo: estos filtros del enlace no existen en la galer\u00eda y no se aplicaron \u2192 ' + noEncontrados.join(' \u2014 ');
      var toolbar = document.querySelector('.toolbar');
      var ref = toolbar || gallery;
      ref.parentNode.insertBefore(warn, ref);
    }
  }

  function openLightbox(photo) {
    currentLightboxPhoto = photo;
    var id = String(photo.id_foto || photo.id);
    lightboxImage.src = photo.url;
    lightboxImage.alt = 'Fotografía ' + id;
    lightboxMeta.textContent = [
      'ID foto: ' + id,
      'Ruta: ' + (photo.ruta_archivo || ''),
      [
        displayValue('clientes', photo.clientes || photo.cliente),
        displayValue('cadena', photo.cadena),
        displayValue('formato', photo.formato),
        displayValue('codigo_local', photo.codigo_local || photo.id_local),
        displayValue('nombre_local', photo.nombre_local),
        formatPhotoDateTime(photo.creado_en) || formatPhotoDate(photo.fecha)
      ].filter(Boolean).join(' · ')
    ].filter(Boolean).join(' | ');
    lightbox.classList.add('open');
  }

  function closeLightbox() {
    currentLightboxPhoto = null;
    lightbox.classList.remove('open');
    lightboxImage.removeAttribute('src');
  }

  lightbox.querySelector('.photo-lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function (event) {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && currentLightboxPhoto) closeLightbox();
  });

  document.addEventListener('click', closeDropdowns);
  document.querySelectorAll('.cat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.setTimeout(function () {
        renderFilters();
        loadPhotos();
      }, 0);
    });
  });

  applyBtn.addEventListener('click', loadPhotos);
  clearFiltersBtn.addEventListener('click', function () {
    filtersEl.querySelectorAll('input[type="checkbox"]').forEach(function (input) { input.checked = false; });
    filtersEl.querySelectorAll('input[type="date"], .dd-search').forEach(function (input) { input.value = ''; });
    filtersEl.querySelectorAll('.filter').forEach(function (btn) { btn.classList.remove('has-selection'); });
    updateClearFiltersButton();
    loadPhotos();
  });
  selectAll.addEventListener('click', function () {
    var allSelected = photos.length && Object.keys(selected).length === photos.length;
    selected = {};
    document.querySelectorAll('.photo').forEach(function (card, index) {
      if (!allSelected) selected[String(photos[index].id_foto || photos[index].id)] = photos[index];
      card.setAttribute('aria-selected', allSelected ? 'false' : 'true');
    });
    updateSelection();
  });
  downloadBtn.addEventListener('click', function () {
    var selectedPhotos = Object.keys(selected).map(function (id) { return selected[id]; });
    if (selectedPhotos.length === 0) return;
    downloadBtn.disabled = true;
    dlLabel.textContent = selectedPhotos.length === 1 ? 'Descargando...' : 'Preparando ZIP...';
    (selectedPhotos.length === 1 ? downloadSinglePhoto(selectedPhotos[0]) : downloadZip(selectedPhotos))
      .finally(function () {
        downloadBtn.disabled = false;
        updateSelection();
      });
  });

  function photoFileName(photo, index) {
    var id = String(photo.id_foto || photo.id || index + 1);
    var ruta = String(photo.ruta_archivo || '');
    var original = ruta.split('/').pop() || ('foto-' + id + '.jpg');
    var extensionMatch = original.match(/\.([a-zA-Z0-9]+)$/);
    var extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
    var timestamp = fileSafeSegment(formatPhotoDateTime(photo.creado_en) || formatPhotoDate(photo.fecha), 'sin-fecha');
    return [
      fileSafeSegment(photo.cadena, 'sin-cadena'),
      fileSafeSegment(photo.codigo_local || photo.id_local, 'sin-local'),
      timestamp,
      'foto-' + id
    ].join('-') + '.' + extension;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function fetchPhotoBlob(photo) {
    return fetch(photo.url).then(function (response) {
      if (!response.ok) throw new Error('No se pudo descargar ' + photo.url);
      return response.blob();
    });
  }

  function downloadSinglePhoto(photo) {
    return fetchPhotoBlob(photo).then(function (blob) {
      downloadBlob(blob, photoFileName(photo, 0));
    });
  }

  function zipFileName() {
    var sectionNames = {
      gondola: 'Gondola',
      carteleria: 'Carteleria',
      exhibicion: 'Exhibiciones',
      exhibicion_adicional: 'ExhibicionesAdicionales'
    };
    return 'Fotografias-RetailExperts(' + (sectionNames[currentType()] || 'Galeria') + ').zip';
  }

  function downloadZip(photoList) {
    return Promise.all(photoList.map(function (photo, index) {
      return fetchPhotoBlob(photo).then(function (blob) {
        return blob.arrayBuffer().then(function (buffer) {
          return { name: photoFileName(photo, index), bytes: new Uint8Array(buffer) };
        });
      });
    })).then(function (files) {
      downloadBlob(createZip(files), zipFileName());
    });
  }

  var crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = [];
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUint16(out, value) {
    out.push(value & 255, (value >>> 8) & 255);
  }

  function writeUint32(out, value) {
    out.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
  }

  function writeBytes(out, bytes) {
    for (var i = 0; i < bytes.length; i++) out.push(bytes[i]);
  }

  function createZip(files) {
    var encoder = new TextEncoder();
    var out = [];
    var central = [];
    var offset = 0;
    files.forEach(function (file) {
      var nameBytes = encoder.encode(file.name);
      var crc = crc32(file.bytes);
      var localOffset = offset;
      writeUint32(out, 0x04034b50);
      writeUint16(out, 20);
      writeUint16(out, 0);
      writeUint16(out, 0);
      writeUint16(out, 0);
      writeUint16(out, 0);
      writeUint32(out, crc);
      writeUint32(out, file.bytes.length);
      writeUint32(out, file.bytes.length);
      writeUint16(out, nameBytes.length);
      writeUint16(out, 0);
      writeBytes(out, nameBytes);
      writeBytes(out, file.bytes);
      offset = out.length;

      writeUint32(central, 0x02014b50);
      writeUint16(central, 20);
      writeUint16(central, 20);
      writeUint16(central, 0);
      writeUint16(central, 0);
      writeUint16(central, 0);
      writeUint16(central, 0);
      writeUint32(central, crc);
      writeUint32(central, file.bytes.length);
      writeUint32(central, file.bytes.length);
      writeUint16(central, nameBytes.length);
      writeUint16(central, 0);
      writeUint16(central, 0);
      writeUint16(central, 0);
      writeUint16(central, 0);
      writeUint32(central, 0);
      writeUint32(central, localOffset);
      writeBytes(central, nameBytes);
    });
    var centralOffset = out.length;
    writeBytes(out, central);
    writeUint32(out, 0x06054b50);
    writeUint16(out, 0);
    writeUint16(out, 0);
    writeUint16(out, files.length);
    writeUint16(out, files.length);
    writeUint32(out, central.length);
    writeUint32(out, centralOffset);
    writeUint16(out, 0);
    return new Blob([new Uint8Array(out)], { type: 'application/zip' });
  }

  window.RetailAPI.requestJson('/web/galeria/filtros')
    .then(function (payload) {
      filterOptions = payload || {};
      renderFilters();
      return loadPhotos();
    })
    .catch(function () {
      if (IS_PREVIEW) {
        filterOptions = PREVIEW_FILTERS;
        renderFilters();
        loadPhotos();
      } else {
        gallery.innerHTML = '<div class="gallery-empty">No se pudieron cargar los filtros.</div>';
      }
    });
})();
