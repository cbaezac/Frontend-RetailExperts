(function () {
  if (!window.RetailAPI || !window.RetailAPI.requireAdminAuth()) return;

  var API = window.RetailAPI;
  var mode = document.body.getAttribute('data-maintainer');
  var state = { page: 1, limit: 50, options: {}, rows: [], total: 0, solicitudes: [] };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function boolLabel(value) { return value ? 'Sí' : 'No'; }
  function optionHtml(items, valueKey, labelKey) {
    return (items || []).map(function (item) {
      var value = typeof item === 'object' ? item[valueKey] : item;
      var label = typeof item === 'object' ? item[labelKey] : item;
      return '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + '</option>';
    }).join('');
  }
  function toast(message) {
    var el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2800);
  }
  function query(extra) {
    var q = $('q') ? $('q').value.trim() : '';
    return Object.assign({ page: state.page, limit: state.limit, q: q }, extra || {});
  }
  function requestJson(path, options) {
    return API.requestJson(path, options).catch(function (err) {
      toast(err.message || 'Error inesperado');
      throw err;
    });
  }

  function loadOptions() {
    return requestJson('/web/admin/mantenedores/opciones').then(function (data) {
      state.options = data || {};
      var cliente = $('id_cliente');
      if (cliente) cliente.innerHTML = '<option value="">Cliente</option>' + optionHtml(state.options.clientes, 'id', 'nombre');
      var filtroCliente = $('filter-cliente');
      if (filtroCliente) filtroCliente.innerHTML = '<option value="">Todos los clientes</option>' + optionHtml(state.options.clientes, 'nombre', 'nombre');
    });
  }

  function load() {
    if (mode === 'locales') return loadLocales();
    if (mode === 'productos') return loadProductos();
    if (mode === 'local-producto') return Promise.all([loadLocalProducto(), loadSolicitudes()]);
    if (mode === 'rutas') return loadRutas();
  }

  function loadLocales() {
    return requestJson('/web/admin/mantenedores/locales' + API.buildQuery(query())).then(function (data) {
      state.rows = data.locales || [];
      state.total = data.total || 0;
      renderLocales();
    });
  }

  function renderLocales() {
    $('summary').textContent = 'Mostrando ' + state.rows.length + ' de ' + state.total + ' locales';
    $('tbody').innerHTML = state.rows.map(function (r) {
      return '<tr>' +
        '<td class="sticky">' + escapeHtml(r.id) + '</td>' +
        '<td>' + escapeHtml(r.nombre) + '</td>' +
        '<td>' + escapeHtml(r.cadena) + '</td>' +
        '<td>' + escapeHtml(r.formato) + '</td>' +
        '<td>' + escapeHtml(r.ruta || '') + '</td>' +
        '<td><span class="pill ' + (r.lo_cubrimos ? 'ok' : 'muted') + '">' + boolLabel(r.lo_cubrimos) + '</span></td>' +
        '<td><button class="icon-btn" data-edit="' + escapeHtml(r.id) + '">Editar</button></td>' +
        '</tr>';
    }).join('') || emptyRow(7);
  }

  function loadProductos() {
    var params = query();
    var cliente = $('filter-cliente') && $('filter-cliente').value;
    if (cliente) params.cliente = cliente;
    return requestJson('/web/admin/mantenedores/productos' + API.buildQuery(params)).then(function (data) {
      state.rows = data.productos || [];
      state.total = data.total || 0;
      renderProductos();
    });
  }

  function renderProductos() {
    $('summary').textContent = 'Mostrando ' + state.rows.length + ' de ' + state.total + ' productos';
    $('tbody').innerHTML = state.rows.map(function (r) {
      return '<tr>' +
        '<td class="sticky">' + escapeHtml(r.codigo_producto) + '</td>' +
        '<td>' + escapeHtml(r.nombre) + '</td>' +
        '<td>' + escapeHtml(r.cliente) + '</td>' +
        '<td>' + escapeHtml(r.cadena) + '</td>' +
        '<td>' + escapeHtml(r.categoria_tareas || r.categoria || '') + '</td>' +
        '<td>' + escapeHtml(r.ean || '') + '</td>' +
        '<td><button class="icon-btn" data-edit="' + escapeHtml(r.id) + '">Editar</button></td>' +
        '</tr>';
    }).join('') || emptyRow(7);
  }

  function loadLocalProducto() {
    return requestJson('/web/admin/mantenedores/local-producto' + API.buildQuery(query())).then(function (data) {
      state.rows = data.relaciones || [];
      state.total = data.total || 0;
      renderLocalProducto();
    });
  }

  function renderLocalProducto() {
    $('summary').textContent = 'Mostrando ' + state.rows.length + ' de ' + state.total + ' relaciones';
    $('tbody').innerHTML = state.rows.map(function (r) {
      return '<tr>' +
        '<td class="sticky">' + escapeHtml(r.id_local) + '</td>' +
        '<td>' + escapeHtml(r.nombre_local) + '</td>' +
        '<td>' + escapeHtml(r.cliente) + '</td>' +
        '<td>' + escapeHtml(r.codigo_producto) + '</td>' +
        '<td>' + escapeHtml(r.producto) + '</td>' +
        '<td><span class="pill ' + (r.lo_gestionamos ? 'ok' : 'muted') + '">' + boolLabel(r.lo_gestionamos) + '</span></td>' +
        '<td><button class="icon-btn" data-edit="' + escapeHtml(r.id) + '">Editar</button></td>' +
        '</tr>';
    }).join('') || emptyRow(7);
  }

  function loadSolicitudes() {
    return requestJson('/web/admin/mantenedores/solicitudes-local-cliente?estado=pendiente').then(function (data) {
      state.solicitudes = data.solicitudes || [];
      renderSolicitudes();
    });
  }

  function renderSolicitudes() {
    var panel = $('solicitudes');
    if (!panel) return;
    panel.innerHTML = state.solicitudes.map(function (s) {
      return '<article class="request-card">' +
        '<div><strong>' + escapeHtml(s.tipo === 'agregar' ? 'Agregar cliente' : 'Quitar cliente') + '</strong>' +
        '<p>' + escapeHtml(s.cliente) + ' · ' + escapeHtml(s.id_local) + ' · ' + escapeHtml(s.nombre_local) + '</p></div>' +
        '<div class="row-actions">' +
        (s.tipo === 'agregar' ? '<button class="secondary" data-approve-add="' + s.id + '">Aprobar</button>' : '<button class="secondary" data-approve-remove="' + s.id + '">Aprobar</button>') +
        '<button class="ghost" data-reject="' + s.id + '">Rechazar</button>' +
        '</div></article>';
    }).join('') || '<p class="empty">No hay solicitudes pendientes.</p>';
  }

  function loadRutas() {
    return requestJson('/web/admin/mantenedores/rutas' + API.buildQuery(query({ limit: 200 }))).then(function (data) {
      state.rows = data.rutas || [];
      state.total = data.total || 0;
      renderRutas();
    });
  }

  function renderRutas() {
    $('summary').textContent = 'Mostrando ' + state.rows.length + ' de ' + state.total + ' salas';
    $('tbody').innerHTML = state.rows.map(function (r) {
      var clientes = (r.clientes || []).map(function (c) { return c.nombre; }).join(', ');
      return '<tr>' +
        '<td class="sticky">' + escapeHtml(r.id) + '</td>' +
        '<td>' + escapeHtml(r.nombre) + '</td>' +
        '<td>' + escapeHtml(r.cadena) + '</td>' +
        '<td>' + escapeHtml(r.formato) + '</td>' +
        '<td>' + escapeHtml(r.ruta || '') + '</td>' +
        '<td>' + escapeHtml(r.dias_visita || '') + '</td>' +
        '<td class="clients-cell">' + escapeHtml(clientes) + '</td>' +
        '<td><button class="icon-btn" data-edit="' + escapeHtml(r.id) + '">Editar</button></td>' +
        '</tr>';
    }).join('') || emptyRow(8);
  }

  function emptyRow(cols) {
    return '<tr><td colspan="' + cols + '" class="empty">Sin resultados.</td></tr>';
  }

  function resetForm() {
    var form = $('editor');
    if (form) form.reset();
    var id = $('record-id');
    if (id) id.value = '';
    var box = $('editor-wrap');
    if (box) box.classList.add('open');
  }

  function fillLocal(row) {
    resetForm();
    $('record-id').value = row.id;
    $('id').value = row.id || '';
    $('nombre').value = row.nombre || '';
    $('cadena').value = row.cadena || '';
    $('formato').value = row.formato || '';
    $('region').value = row.region || '';
    $('comuna').value = row.comuna || '';
    $('direccion').value = row.direccion || '';
    $('lo_cubrimos').checked = !!row.lo_cubrimos;
  }

  function fillProducto(row) {
    resetForm();
    $('record-id').value = row.id;
    $('codigo_producto').value = row.codigo_producto || '';
    $('nombre').value = row.nombre || '';
    $('id_cliente').value = row.id_cliente || '';
    $('cadena').value = row.cadena || '';
    $('categoria_tareas').value = row.categoria_tareas || '';
    $('ean').value = row.ean || '';
    $('estado').value = row.estado || '';
    $('lo_gestionamos').checked = row.lo_gestionamos !== false;
  }

  function fillRelacion(row) {
    resetForm();
    $('record-id').value = row.id;
    $('id_local').value = row.id_local || '';
    $('id_producto').value = row.id_producto || '';
    $('lo_gestionamos').checked = !!row.lo_gestionamos;
  }

  function fillRuta(row) {
    resetForm();
    $('record-id').value = row.id;
    $('id_local').value = row.id || '';
    $('local-name').textContent = row.id + ' · ' + row.nombre;
    $('ruta').value = row.ruta || '';
    $('dias_visita').value = row.dias_visita || '';
    var active = {};
    (row.clientes || []).forEach(function (c) { active[c.id] = true; });
    $('clientes-box').innerHTML = (state.options.clientes || []).map(function (c) {
      return '<label class="check-row"><input type="checkbox" name="cliente" value="' + c.id + '" ' + (active[c.id] ? 'checked' : '') + ' data-original="' + (active[c.id] ? '1' : '0') + '"> ' + escapeHtml(c.nombre) + '</label>';
    }).join('');
  }

  function payloadFromForm() {
    var form = $('editor');
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return data;
  }

  function saveCurrent(e) {
    e.preventDefault();
    var data = payloadFromForm();
    var id = $('record-id') && $('record-id').value;
    var path;
    var method = id ? 'PATCH' : 'POST';
    if (mode === 'locales') path = '/web/admin/mantenedores/locales' + (id ? '/' + encodeURIComponent(id) : '');
    if (mode === 'productos') path = '/web/admin/mantenedores/productos' + (id ? '/' + encodeURIComponent(id) : '');
    if (mode === 'local-producto') path = '/web/admin/mantenedores/local-producto' + (id ? '/' + encodeURIComponent(id) : '');
    if (mode === 'rutas') {
      path = '/web/admin/mantenedores/rutas/' + encodeURIComponent(data.id_local);
      method = 'PATCH';
      data.solicitudes = collectClientRequests();
    }
    return requestJson(path, { method: method, body: JSON.stringify(data) }).then(function () {
      toast('Cambios guardados');
      $('editor-wrap').classList.remove('open');
      return load();
    });
  }

  function collectClientRequests() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#clientes-box input[name="cliente"]'), function (input) {
      var was = input.getAttribute('data-original') === '1';
      if (was === input.checked) return;
      out.push({
        id_cliente: Number(input.value),
        tipo: input.checked ? 'agregar' : 'quitar',
        comentario: 'Solicitud creada desde mantenedor de rutas'
      });
    });
    return out;
  }

  function approveAdd(solicitud) {
    var productIds = window.prompt('IDs de productos a gestionar para ' + solicitud.cliente + ' en ' + solicitud.id_local + ' separados por coma');
    if (!productIds) return;
    var ids = productIds.split(',').map(function (x) { return Number(x.trim()); }).filter(Boolean);
    requestJson('/web/admin/mantenedores/solicitudes-local-cliente/' + solicitud.id, {
      method: 'PATCH',
      body: JSON.stringify({ accion: 'aprobar', producto_ids: ids })
    }).then(function () {
      toast('Solicitud aprobada');
      return load();
    });
  }

  function resolveSolicitud(id, action) {
    requestJson('/web/admin/mantenedores/solicitudes-local-cliente/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ accion: action })
    }).then(function () {
      toast(action === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      return load();
    });
  }

  document.addEventListener('click', function (e) {
    var edit = e.target.closest('[data-edit]');
    if (edit) {
      var id = edit.getAttribute('data-edit');
      var row = state.rows.find(function (r) { return String(r.id) === String(id); });
      if (mode === 'rutas') row = state.rows.find(function (r) { return String(r.id) === String(id); });
      if (!row) return;
      if (mode === 'locales') fillLocal(row);
      if (mode === 'productos') fillProducto(row);
      if (mode === 'local-producto') fillRelacion(row);
      if (mode === 'rutas') fillRuta(row);
    }
    var reject = e.target.closest('[data-reject]');
    if (reject) resolveSolicitud(reject.getAttribute('data-reject'), 'rechazar');
    var remove = e.target.closest('[data-approve-remove]');
    if (remove) resolveSolicitud(remove.getAttribute('data-approve-remove'), 'aprobar');
    var add = e.target.closest('[data-approve-add]');
    if (add) {
      var solicitud = state.solicitudes.find(function (s) { return String(s.id) === String(add.getAttribute('data-approve-add')); });
      if (solicitud) approveAdd(solicitud);
    }
  });

  function init() {
    var form = $('editor');
    if (form) form.addEventListener('submit', saveCurrent);
    var add = $('new-record');
    if (add) add.addEventListener('click', resetForm);
    var cancel = $('cancel-editor');
    if (cancel) cancel.addEventListener('click', function () { $('editor-wrap').classList.remove('open'); });
    var search = $('search-form');
    if (search) search.addEventListener('submit', function (e) { e.preventDefault(); state.page = 1; load(); });
    var filterCliente = $('filter-cliente');
    if (filterCliente) filterCliente.addEventListener('change', function () { state.page = 1; load(); });
    loadOptions().then(load);
  }

  init();
})();
