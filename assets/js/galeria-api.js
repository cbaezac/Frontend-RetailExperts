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
    'Cliente': 'cliente',
    'Ruta': 'ruta',
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
  style.textContent = '.photo img{width:100%;height:100%;object-fit:cover;display:block}.photo-meta{position:absolute;left:12px;right:12px;bottom:12px;padding:9px 11px;border-radius:8px;background:rgba(0,0,0,.74);color:#fff;font:800 13px Inter,sans-serif;text-align:left;box-shadow:0 8px 18px rgba(0,0,0,.22)}.photo-meta-main{display:block;font-size:13px;line-height:1.25}.photo-tech-badge{position:absolute;left:10px;top:10px;right:52px;z-index:2;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.74);color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;line-height:1.25;text-align:left;overflow-wrap:anywhere;box-shadow:0 8px 18px rgba(0,0,0,.22)}.photo-tech-badge strong{font-weight:800;color:#fff8e7}.photo-expand{position:absolute;right:10px;bottom:10px;z-index:3;width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,255,255,.88);background:rgba(0,0,0,.7);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 18px rgba(0,0,0,.25)}.photo-expand:hover{background:#e0561c}.gallery-empty{grid-column:1/-1;padding:48px 18px;text-align:center;color:rgba(28,26,20,.58);font-weight:700}.gallery-loading{grid-column:1/-1;padding:48px 18px;text-align:center;color:rgba(28,26,20,.62);font-weight:700}.gallery-pager{display:flex;align-items:center;justify-content:center;gap:16px;margin:34px 0 6px;flex-wrap:wrap}.gallery-pager-info{font:700 14px Inter,sans-serif;color:rgba(28,26,20,.64)}.gallery-load-more{border:0;border-radius:999px;background:#11100b;color:#fff8e7;font:800 15px Inter,sans-serif;padding:14px 28px;cursor:pointer;box-shadow:0 14px 30px rgba(28,26,20,.18)}.gallery-load-more:hover{transform:translateY(-1px)}.gallery-load-more:disabled{opacity:.45;cursor:not-allowed;transform:none}.btn-clear-filters{border:0;border-radius:999px;padding:13px 22px;font:800 14px Inter,sans-serif;background:rgba(28,26,20,.08);color:rgba(28,26,20,.54);cursor:pointer}.btn-clear-filters.active{background:#e0561c;color:#fff8e7;box-shadow:0 12px 26px rgba(224,86,28,.26)}.photo-lightbox{position:fixed;inset:0;z-index:9999;background:rgba(16,14,10,.88);display:none;align-items:center;justify-content:center;padding:28px}.photo-lightbox.open{display:flex}.photo-lightbox-dialog{position:relative;width:min(1180px,96vw);max-height:94vh;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px}.photo-lightbox-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff8e7;font:700 13px Inter,sans-serif}.photo-lightbox-meta{padding:10px 12px;border-radius:8px;background:rgba(0,0,0,.58);overflow-wrap:anywhere}.photo-lightbox-close{border:0;border-radius:50%;width:42px;height:42px;background:#fff8e7;color:#11100b;font:900 22px Inter,sans-serif;cursor:pointer}.photo-lightbox img{max-width:100%;max-height:calc(94vh - 76px);object-fit:contain;justify-self:center;align-self:center;border-radius:4px;box-shadow:0 22px 60px rgba(0,0,0,.38)}';
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

  var pager = document.createElement('div');
  pager.className = 'gallery-pager';
  pager.innerHTML = '<span class="gallery-pager-info" id="galleryPagerInfo"></span><button class="gallery-load-more" id="galleryLoadMore" type="button">Cargar más fotos</button>';
  gallery.insertAdjacentElement('afterend', pager);
  var pagerInfo = document.getElementById('galleryPagerInfo');
  var loadMoreBtn = document.getElementById('galleryLoadMore');

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
    if (name === 'Cliente') return unique(filterOptions.clientes);
    if (name === 'Ruta') return unique(filterOptions.rutas);
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

  function updatePager() {
    var loaded = photos.length;
    var hasMore = loaded < totalPhotos;
    pagerInfo.textContent = totalPhotos
      ? 'Mostrando ' + loaded + ' de ' + totalPhotos + ' fotografías'
      : 'Sin fotografías para mostrar';
    loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
    loadMoreBtn.disabled = isLoading || !hasMore;
    loadMoreBtn.textContent = isLoading ? 'Cargando...' : 'Cargar más fotos';
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
      var metaMain = [photo.cadena, photo.codigo_local, photo.fecha].filter(Boolean).join(' · ');
      photos.push(photo);
      var card = document.createElement('div');
      card.className = 'photo';
      card.setAttribute('aria-selected', 'false');
      card.setAttribute('data-foto-id', id);
      card.setAttribute('data-ruta-archivo', rutaArchivo);
      card.innerHTML =
        '<img src="' + escapeHtml(photo.url) + '" alt="Fotografía ' + escapeHtml(id) + '" loading="lazy">' +
        '<div class="photo-tech-badge">' +
          '<div><strong>ID foto:</strong> ' + escapeHtml(id) + '</div>' +
          '<div><strong>Ruta:</strong> ' + escapeHtml(rutaArchivo) + '</div>' +
        '</div>' +
        '<div class="photo-meta">' +
          '<span class="photo-meta-main">' + escapeHtml(metaMain) + '</span>' +
        '</div>' +
        '<button class="photo-expand" type="button" aria-label="Ampliar foto">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3H3v5M3 3l7 7M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M16 21h5v-5M21 21l-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
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
    if (!options.append) {
      currentPage = 1;
      totalPhotos = 0;
      gallery.innerHTML = '<div class="gallery-loading">Cargando fotografías...</div>';
    }
    updatePager();
    return window.RetailAPI.requestJson('/web/galeria/fotos' + window.RetailAPI.buildQuery(collectParams()))
      .then(function (payload) {
        totalPhotos = Number(payload.total || 0);
        renderPhotos(payload.fotos || payload.data || [], !!options.append);
      })
      .catch(function () { gallery.innerHTML = '<div class="gallery-empty">No se pudieron cargar las fotografías.</div>'; })
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
      updateClearFiltersButton();
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
      ['Fecha', 'Cadena', 'Formato', 'Código Local', 'Nombre Local', 'Categoría'];
    if (isPrivilegedUser()) names = names.concat(['Cliente', 'Ruta']);
    names.forEach(buildFilter);
    updateClearFiltersButton();
  }

  function openLightbox(photo) {
    currentLightboxPhoto = photo;
    var id = String(photo.id_foto || photo.id);
    lightboxImage.src = photo.url;
    lightboxImage.alt = 'Fotografía ' + id;
    lightboxMeta.textContent = [
      'ID foto: ' + id,
      'Ruta: ' + (photo.ruta_archivo || ''),
      [photo.clientes, photo.cadena, photo.codigo_local, photo.fecha].filter(Boolean).join(' · ')
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
  loadMoreBtn.addEventListener('click', function () {
    if (photos.length >= totalPhotos) return;
    currentPage += 1;
    loadPhotos({ append: true });
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
    return id + '-' + original.replace(/[^a-zA-Z0-9._-]/g, '_');
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

  function downloadZip(photoList) {
    return Promise.all(photoList.map(function (photo, index) {
      return fetchPhotoBlob(photo).then(function (blob) {
        return blob.arrayBuffer().then(function (buffer) {
          return { name: photoFileName(photo, index), bytes: new Uint8Array(buffer) };
        });
      });
    })).then(function (files) {
      downloadBlob(createZip(files), 'fotografias-retail-experts.zip');
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
      gallery.innerHTML = '<div class="gallery-empty">No se pudieron cargar los filtros.</div>';
    });
})();
