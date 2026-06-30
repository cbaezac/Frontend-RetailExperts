(function () {
  'use strict';

  var API = window.RetailAPI;
  var C = window.MANT_CONFIG;
  if (!API || !C || !['locales', 'productos', 'localproducto'].includes(C.key)) return;

  var mode = C.key;
  var storeKey = C.storeKey;
  var params = new URLSearchParams(window.location.search);
  var options = null;

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
      nomprod: row.producto || '', gestiona: row.lo_gestionamos ? 'Sí' : 'No' };
  }

  function loadRealData() {
    var endpoint = mode === 'locales' ? '/web/admin/mantenedores/locales?limit=500&page=1'
      : mode === 'productos' ? '/web/admin/mantenedores/productos?limit=500&page=1'
      : '/web/admin/mantenedores/local-producto?limit=500&page=1';
    return Promise.all([
      request(endpoint),
      request('/web/admin/mantenedores/opciones')
    ]).then(function (result) {
      options = result[1] || {};
      sessionStorage.setItem('re_mant_backend_options', JSON.stringify(options));
      var rows = mode === 'locales' ? (result[0].locales || []).map(mapLocal)
        : mode === 'productos' ? (result[0].productos || []).map(mapProduct)
        : (result[0].relaciones || []).map(mapLocalProduct);
      localStorage.setItem(storeKey, JSON.stringify(rows));
      params.set('_backend', '1');
      window.location.replace(window.location.pathname + '?' + params.toString());
    });
  }

  function readRows() {
    try { return JSON.parse(localStorage.getItem(storeKey) || '[]'); }
    catch (_) { return []; }
  }

  function value(key) {
    var el = document.getElementById('mf-' + key);
    return el ? String(el.value || '').trim() : '';
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

  document.addEventListener('click', function (event) {
    var save = event.target.closest('#e-save');
    if (save) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (mode === 'localproducto') return toast('Local–Producto es de solo lectura');
      var id = value(C.idField);
      var existing = readRows().filter(function (row) { return String(row[C.idField]) === String(id); })[0] || null;
      save.disabled = true;
      (mode === 'locales' ? saveLocal(existing) : saveProduct(existing))
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
      if (mode === 'localproducto') return toast('Local–Producto se modifica desde Rutas o aprobando propuestas');
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
    style.textContent = 'body .row-actions{display:none!important} body th:last-child{display:none!important} body td:last-child{display:none!important}';
    document.head.appendChild(style);
  }

  if (!params.has('_backend')) loadRealData();
})();
