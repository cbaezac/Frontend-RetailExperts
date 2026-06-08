(function () {
  if (!window.RetailAPI || !window.RetailAPI.requireAuth()) return;

  var TYPE_BY_LABEL = {
    'Góndola': 'gondola',
    'Cartelería': 'carteleria',
    'Exhibiciones': 'exhibicion',
    'Exhibiciones Adicionales': 'exhibicion_adicional'
  };
  var PARAM_BY_FILTER = {
    'Cadena': 'cadena',
    'Formato': 'formato',
    'Código Local': 'codigo_local',
    'Nombre Local': 'nombre_local',
    'Categoría': 'categoria',
    'Nombre Ciclo': 'categoria',
    'Mueble': 'categoria'
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
  style.textContent = '.photo img{width:100%;height:100%;object-fit:cover;display:block}.photo-meta{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,.72));color:#fff;font:600 12px Inter,sans-serif;text-align:left}.gallery-empty{grid-column:1/-1;padding:48px 18px;text-align:center;color:rgba(28,26,20,.58);font-weight:700}.gallery-loading{grid-column:1/-1;padding:48px 18px;text-align:center;color:rgba(28,26,20,.62);font-weight:700}';
  document.head.appendChild(style);

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

  function optionsFor(name) {
    if (!filterOptions) return [];
    if (name === 'Cadena') return unique(filterOptions.cadenas);
    if (name === 'Formato') return unique(filterOptions.formatos);
    if (name === 'Código Local') return unique(filterOptions.codigos_local);
    if (name === 'Nombre Local') return unique(filterOptions.nombres_local);
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
    var params = { tipo: currentType(), page: 1, limit: 60 };
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

  function renderPhotos(items) {
    photos = items || [];
    selected = {};
    gallery.innerHTML = '';
    if (!photos.length) {
      gallery.innerHTML = '<div class="gallery-empty">No hay fotografías para estos filtros.</div>';
      updateSelection();
      return;
    }

    photos.forEach(function (photo) {
      var id = String(photo.id_foto || photo.id);
      var card = document.createElement('div');
      card.className = 'photo';
      card.setAttribute('aria-selected', 'false');
      card.innerHTML =
        '<img src="' + photo.url + '" alt="Fotografía ' + id + '" loading="lazy">' +
        '<div class="photo-meta">' + [photo.cadena, photo.codigo_local, photo.fecha].filter(Boolean).join(' · ') + '</div>' +
        '<div class="check"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="#FFF8E7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
      card.addEventListener('click', function () {
        if (selected[id]) delete selected[id];
        else selected[id] = photo;
        card.setAttribute('aria-selected', selected[id] ? 'true' : 'false');
        updateSelection();
      });
      gallery.appendChild(card);
    });
    updateSelection();
  }

  function loadPhotos() {
    gallery.innerHTML = '<div class="gallery-loading">Cargando fotografías...</div>';
    return window.RetailAPI.requestJson('/web/galeria/fotos' + window.RetailAPI.buildQuery(collectParams()))
      .then(function (payload) { renderPhotos(payload.fotos || payload.data || []); })
      .catch(function () { gallery.innerHTML = '<div class="gallery-empty">No se pudieron cargar las fotografías.</div>'; });
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
        item.innerHTML = '<input type="checkbox" value="' + opt.replace(/"/g, '&quot;') + '" /><span>' + opt + '</span>';
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
    dd.addEventListener('change', function () {
      var count = dd.querySelectorAll('input[type="checkbox"]:checked').length;
      btn.classList.toggle('has-selection', count > 0);
    });
    var search = dd.querySelector('.dd-search');
    if (search) {
      search.addEventListener('input', function () {
        var q = search.value.toLowerCase();
        dd.querySelectorAll('.dd-item').forEach(function (item) {
          item.style.display = item.textContent.toLowerCase().indexOf(q) === -1 ? 'none' : 'flex';
        });
      });
    }
    var clear = dd.querySelector('.dd-clear');
    if (clear) clear.addEventListener('click', function () {
      dd.querySelectorAll('input').forEach(function (input) { input.value = ''; });
      btn.classList.remove('has-selection');
      closeDropdowns();
    });
    var dateApply = dd.querySelector('.dd-apply');
    if (dateApply) dateApply.addEventListener('click', function () {
      btn.classList.toggle('has-selection', !!selectedDate('start') || !!selectedDate('end'));
      closeDropdowns();
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
      ['Fecha', 'Cadena', 'Formato', 'Código Local', 'Nombre Local', 'Categoría'];
    names.forEach(buildFilter);
  }

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
    Object.keys(selected).forEach(function (id) {
      var photo = selected[id];
      var a = document.createElement('a');
      a.href = photo.url;
      a.download = 'foto-' + id;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  });

  window.RetailAPI.requestJson('/web/galeria/filtros')
    .then(function (payload) {
      filterOptions = payload || {};
      renderFilters();
      return loadPhotos();
    })
    .catch(function () {
      gallery.innerHTML = '<div class="gallery-empty">No se pudieron cargar los filtros.</div>';
    });
})();
