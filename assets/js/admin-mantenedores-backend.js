(function () {
  'use strict';

  var API = window.RetailAPI;
  var C = window.MANT_CONFIG;
  if (!API || !C || !['locales', 'productos', 'localproducto'].includes(C.key)) return;

  var mode = C.key;
  var storeKey = C.storeKey;
  var params = new URLSearchParams(window.location.search);
  var options = null;
  var backendRows = null;

  function toast(message) {
    if (window._mantToast) return window._mantToast(message);
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3000);
  }

  function request(path, init) {
    return API.requestJson(path, init).catch(function (error) {
      toast(error.message || 'No fue posible conectar con el backend');
      throw error;
    });
  }

  function mapLocal(row) {
    return {
      llave: row.id,
      codigo: row.codigo_local || row.id,
      nombre: row.nombre || '',
      cadena: row.cadena || '',
      formato: row.formato || '',
      region: row.region || '',
      direccion: row.direccion || '',
      estado: row.lo_cubrimos === false ? 'Inactivo' : 'Activo',
      _comuna: row.comuna || ''
    };
  }

  function mapProduct(row) {
    return {
      codigo: row.codigo_producto || '',
      cliente: row.cliente || '',
      cadena: row.cadena || '',
      nombre: row.nombre || '',
      ean: row.ean || '',
      unidad: row.un_x_caja == null ? '' : String(row.un_x_caja),
      marca: row.rubro || '',
      cat1: row.categoria || '',
      catre: row.categoria_tareas || '',
      estado: row.estado || 'Activo',
      _backendId: row.id,
      _idCliente: row.id_cliente,
      _subrubro: row.subrubro || '',
      _seccion: row.seccion || ''
    };
  }

  function mapLocalProduct(row) {
    return { id: row.id, cliente: row.cliente || '', llave: row.id_local || '',
      nomlocal: row.nombre_local || '', codprod: row.codigo_producto || '',
      nomprod: row.producto || '', gestiona: row.lo_gestionamos ? 'Sí' : 'No',
      control: row.bloqueo_manual ? 'Manual' : 'Automático',
      _idProducto: row.id_producto, _bloqueoManual: !!row.bloqueo_manual };
  }

  function loadRealData() {
    var baseEndpoint = mode === 'locales' ? '/web/admin/mantenedores/locales'
      : mode === 'productos' ? '/web/admin/mantenedores/productos'
      : '/web/admin/mantenedores/local-producto';
    var resultKey = mode === 'locales' ? 'locales' : mode === 'productos' ? 'productos' : 'relaciones';
    var pageSize = mode === 'localproducto' ? 5000 : 500;
    function loadAllPages() {
      return request(baseEndpoint + '?limit=' + pageSize + '&page=1').then(function (first) {
        var effectiveLimit = Number(first.limit || pageSize) || pageSize;
        var pages = Math.ceil(Number(first.total || 0) / effectiveLimit);
        var requests = [];
        for (var page = 2; page <= pages; page += 1) {
          requests.push(request(baseEndpoint + '?limit=' + pageSize + '&page=' + page));
        }
        return Promise.all(requests).then(function (rest) {
          var all = (first[resultKey] || []).slice();
          rest.forEach(function (response) { all = all.concat(response[resultKey] || []); });
          first[resultKey] = all;
          return first;
        });
      });
    }
    return Promise.all([
      loadAllPages(),
      request('/web/admin/mantenedores/opciones')
    ]).then(function (result) {
      options = result[1] || {};
      sessionStorage.setItem('re_mant_backend_options', JSON.stringify(options));
      populateSelectsFromOptions();
      var rows = mode === 'locales' ? (result[0].locales || []).map(mapLocal)
        : mode === 'productos' ? (result[0].productos || []).map(mapProduct)
        : (result[0].relaciones || []).map(mapLocalProduct);
      backendRows = rows;
      if (mode === 'localproducto') {
        window.MANT_BACKEND_ROWS = rows;
        window.dispatchEvent(new CustomEvent('mant:backend-data', { detail: rows }));
        return rows;
      }
      var serialized = JSON.stringify(rows);
      var changed = localStorage.getItem(storeKey) !== serialized;
      localStorage.setItem(storeKey, serialized);
      if (changed) {
        params.set('_backend', String(Date.now()));
        window.location.replace(window.location.pathname + '?' + params.toString());
      }
      return rows;
    });
  }

  function readRows() {
    if (backendRows) return backendRows;
    try { return JSON.parse(localStorage.getItem(storeKey) || '[]'); }
    catch (_) { return []; }
  }

  function value(key) {
    var el = document.getElementById('mf-' + key);
    return el ? String(el.value || '').trim() : '';
  }

  // --- Historial real (backend) ---
  // El guardado real pasa por este script y el backend audita cada alta/edición/
  // baja en web_mantenedor_cambios. El panel de Historial lee de ahí (no de
  // localStorage), así cualquier admin ve las modificaciones reales desde
  // cualquier equipo, con el usuario que las hizo.
  var historialCache = null;
  var ACCION_LABEL = { alta: 'Alta', edicion: 'Edición', baja: 'Baja' };
  var ACCION_CLASS = { alta: 'add', edicion: 'edit', baja: 'del' };
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtFecha(ts) {
    try { return new Date(ts).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return String(ts || ''); }
  }
  function renderHistorial(body, cambios) {
    if (!body) return;
    if (!cambios || !cambios.length) { body.innerHTML = '<p class="log-empty">Aún no se han registrado cambios.</p>'; return; }
    body.innerHTML = '<div class="log-list">' + cambios.map(function (e) {
      var acc = ACCION_CLASS[e.accion] || 'edit';
      var diffs = (e.cambios || []).map(function (c) {
        return '<div class="diff-row"><span class="diff-field">' + escHtml(c.campo) + '</span><span class="diff-before">' + escHtml(c.antes) + '</span><span class="diff-arrow">→</span><span class="diff-after">' + escHtml(c.despues) + '</span></div>';
      }).join('');
      var meta = fmtFecha(e.creado_en) + (e.usuario_email ? ' · ' + e.usuario_email : '');
      return '<div class="log-entry"><div class="log-top"><span class="l-id">' + escHtml(e.registro_id) + '</span><span class="l-act ' + acc + '">' + (ACCION_LABEL[e.accion] || e.accion) + '</span><span class="l-time">' + escHtml(meta) + '</span></div>' + diffs + '</div>';
    }).join('') + '</div>';
  }
  function updateHistBadge() {
    var badge = document.getElementById('histCount');
    if (!badge) return;
    if (historialCache && historialCache.length) { badge.style.display = 'inline-block'; badge.textContent = historialCache.length; }
    else badge.style.display = 'none';
  }
  function loadHistorial() {
    // Silencioso (API.requestJson directo, sin el toast del wrapper): el badge y
    // el panel manejan el caso de error por su cuenta.
    return API.requestJson('/web/admin/mantenedores/' + mode + '/historial?limit=200')
      .then(function (resp) { historialCache = (resp && resp.cambios) || []; updateHistBadge(); return historialCache; })
      .catch(function () { return historialCache || []; });
  }
  function wireHistorial() {
    if (mode === 'localproducto') return;
    var histBtn = document.getElementById('hist');
    var overlay = document.getElementById('histOverlay');
    var body = document.getElementById('h-body');
    if (!histBtn || !overlay || !body) return;
    histBtn.addEventListener('click', function (ev) {
      ev.stopImmediatePropagation(); // gana sobre el handler legado (localStorage)
      overlay.classList.add('open');
      if (historialCache) renderHistorial(body, historialCache);
      else body.innerHTML = '<p class="log-empty">Cargando historial…</p>';
      loadHistorial().then(function (list) { renderHistorial(body, list); });
    }, true);
  }

  // --- Poblar los selects del modal con el catálogo real del backend (/opciones) ---
  function optionValues(list, prop) {
    if (!Array.isArray(list)) return [];
    return list.map(function (it) { return prop ? (it && it[prop]) : it; })
      .filter(function (v) { return v != null && v !== ''; });
  }
  function fieldOptionMap() {
    if (!options) {
      // Si el fetch inicial de /opciones falló o aún no llega, usar el cache.
      try { options = JSON.parse(sessionStorage.getItem('re_mant_backend_options') || 'null'); } catch (_) { options = null; }
    }
    if (!options) return {};
    if (mode === 'productos') return {
      cliente: optionValues(options.clientes, 'nombre'),
      cadena: optionValues(options.cadenas),
      marca: optionValues(options.rubros),
      cat1: optionValues(options.categorias),
      catre: optionValues(options.categorias_tareas),
    };
    if (mode === 'locales') return {
      cadena: optionValues(options.cadenas),
      formato: optionValues(options.formatos),
      region: optionValues(options.regiones),
    };
    return {};
  }
  function populateSelectsFromOptions() {
    var map = fieldOptionMap();
    Object.keys(map).forEach(function (key) {
      var el = document.getElementById('mf-' + key);
      if (!el || el.tagName !== 'SELECT') return;
      var vals = map[key];
      if (!vals.length) return;
      var current = el.value;
      var placeholder = el.querySelector('option[value=""]');
      el.innerHTML = '';
      if (placeholder) el.appendChild(placeholder);
      else { var ph = document.createElement('option'); ph.value = ''; ph.disabled = true; ph.textContent = 'Selecciona…'; el.appendChild(ph); }
      vals.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
      if (current) el.value = current;
    });
  }
  // Además de al cargar, poblamos los selects al abrir el modal (captura, antes
  // del openEdit/openAdd del motor). Es determinista y no depende de que el
  // fetch inicial de /opciones haya llegado: usa el cache de sessionStorage.
  function wireModalPopulate() {
    if (mode === 'localproducto') return;
    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-edit]') || event.target.closest('#add')) {
        populateSelectsFromOptions();
      }
    }, true);
  }

  function findClientId(name, fallback) {
    if (!options) {
      try { options = JSON.parse(sessionStorage.getItem('re_mant_backend_options') || '{}'); }
      catch (_) { options = {}; }
    }
    var target = String(name || '').toLowerCase();
    var match = (options.clientes || []).filter(function (item) {
      return String(item.nombre || '').toLowerCase() === target;
    })[0];
    return match ? Number(match.id) : Number(fallback || 0);
  }

  function saveLocal(existing) {
    var id = value('llave').toUpperCase();
    var body = {
      id: id,
      codigo_local: value('codigo') || id,
      cadena: value('cadena'),
      formato: value('formato'),
      nombre: value('nombre'),
      region: value('region'),
      comuna: existing ? existing._comuna : '',
      direccion: value('direccion'),
      lo_cubrimos: value('estado') !== 'Inactivo'
    };
    return request('/web/admin/mantenedores/locales' + (existing ? '/' + encodeURIComponent(id) : ''), {
      method: existing ? 'PATCH' : 'POST',
      body: JSON.stringify(body)
    });
  }

  function saveProduct(existing) {
    var clientId = findClientId(value('cliente'), existing && existing._idCliente);
    if (!clientId) return Promise.reject(new Error('El cliente debe existir en la base de datos'));
    var body = {
      id: existing ? existing._backendId : undefined,
      id_cliente: clientId,
      codigo_producto: value('codigo'),
      cadena: value('cadena'),
      nombre: value('nombre'),
      ean: value('ean'),
      un_x_caja: value('unidad'),
      rubro: value('marca'),
      subrubro: existing ? existing._subrubro : '',
      categoria: value('cat1'),
      seccion: existing ? existing._seccion : '',
      categoria_tareas: value('catre'),
      estado: value('estado'),
      lo_gestionamos: true
    };
    return request('/web/admin/mantenedores/productos' + (existing ? '/' + existing._backendId : ''), {
      method: existing ? 'PATCH' : 'POST',
      body: JSON.stringify(body)
    });
  }

  function saveLocalProduct(existing) {
    if (!existing) return Promise.reject(new Error('La relación debe crearse desde Rutas'));
    return request('/web/admin/mantenedores/local-producto/' + existing.id, {
      method: 'PATCH',
      body: JSON.stringify({
        id: existing.id,
        id_local: existing.llave,
        id_producto: existing._idProducto,
        lo_gestionamos: value('gestiona') === 'Sí'
      })
    });
  }

  document.addEventListener('click', function (event) {
    var save = event.target.closest('#e-save');
    if (save) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var id = value(C.idField);
      var existing = readRows().filter(function (row) { return String(row[C.idField]) === String(id); })[0] || null;
      save.disabled = true;
      (mode === 'locales' ? saveLocal(existing) : mode === 'productos' ? saveProduct(existing) : saveLocalProduct(existing))
        .then(function () {
          toast('Registro guardado en el backend');
          params.delete('_backend');
          setTimeout(function () { window.location.replace(window.location.pathname + (params.toString() ? '?' + params.toString() : '')); }, 350);
        })
        .catch(function (error) { toast(error.message || 'No se pudo guardar'); save.disabled = false; });
      return;
    }

    var remove = event.target.closest('[data-del], #e-delete');
    if (remove) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (mode === 'localproducto') return toast('Para dejar de gestionarlo, edita la fila y selecciona No');
      var deleteId = remove.getAttribute('data-del') || value(C.idField);
      var deleteRow = readRows().filter(function (row) {
        return String(row[C.idField]) === String(deleteId);
      })[0];
      if (!deleteRow) return toast('No se encontró el registro');
      if (!window.confirm('¿Eliminar ' + deleteId + '? Podrás reactivarlo ingresándolo nuevamente desde Agregar.')) return;
      var deletePath = mode === 'locales'
        ? '/web/admin/mantenedores/locales/' + encodeURIComponent(deleteId)
        : '/web/admin/mantenedores/productos/' + encodeURIComponent(deleteRow._backendId);
      request(deletePath, { method: 'DELETE' }).then(function () {
        toast('Registro eliminado');
        params.delete('_backend');
        setTimeout(function () {
          window.location.replace(window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
        }, 350);
      });
    }
  }, true);

  if (mode === 'localproducto') {
    var add = document.getElementById('add'); if (add) add.style.display = 'none';
    var bulk = document.getElementById('bulk'); if (bulk) bulk.style.display = 'none';
    var style = document.createElement('style');
    style.textContent = 'body .icon-del{display:none!important}';
    document.head.appendChild(style);

    var saveButton = document.getElementById('e-save');
    if (saveButton && saveButton.parentNode) {
      var automaticButton = document.createElement('button');
      automaticButton.type = 'button';
      automaticButton.className = 'mbtn';
      automaticButton.textContent = 'Volver a automático';
      automaticButton.onclick = function () {
        var currentId = value(C.idField);
        var row = readRows().filter(function (item) { return String(item.id) === String(currentId); })[0];
        if (!row) return toast('No se encontró la relación');
        automaticButton.disabled = true;
        request('/web/admin/mantenedores/local-producto/' + row.id + '/automatico', {
          method: 'PATCH', body: JSON.stringify({})
        }).then(function () {
          toast('La relación volvió a control automático');
          params.delete('_backend');
          setTimeout(function () { window.location.replace(window.location.pathname); }, 350);
        }).catch(function () { automaticButton.disabled = false; });
      };
      saveButton.parentNode.insertBefore(automaticButton, saveButton);
    }
  }

  // Historial real desde el backend: el panel lo lee de web_mantenedor_cambios,
  // no de localStorage. Se cablea el botón y se precarga el conteo del badge.
  wireHistorial();
  wireModalPopulate();
  if (mode !== 'localproducto') loadHistorial();

  // La API es siempre la fuente visible. localStorage solo permite que el
  // motor legado pinte la tabla mientras llega la respuesta actualizada.
  loadRealData();
})();
