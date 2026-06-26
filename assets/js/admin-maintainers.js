(function () {
  'use strict';

  const API = window.RetailAPI;
  if (!API || !API.requireAdminAuth()) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const mode = document.body.dataset.maintainer || 'locales';
  const base = '/web/admin/mantenedores';

  const pageDefs = {
    locales: {
      path: 'locales',
      rowsKey: 'locales',
      title: 'Maestra de Locales',
      eyebrow: 'Base maestra · Locales',
      head: 'Mantenedor · Locales',
      sub: 'Administra las salas disponibles del sistema. La visibilidad de productos se define en Local-Producto.',
      count: 'locales',
      add: 'Agregar local',
      bulk: 'Carga masiva',
      cols: ['Cadena', 'Codigo local', 'Formato', 'Nombre local', 'Region', 'Comuna', 'Direccion', 'Lo cubrimos', 'Acciones'],
      filters: [
        ['cadena', 'Cadena'],
        ['codigo', 'Codigo Local'],
        ['nombre', 'Nombre Local'],
        ['formato', 'Formato'],
        ['region', 'Region'],
        ['lo_cubrimos', '¿Lo cubrimos?'],
      ],
    },
    productos: {
      path: 'productos',
      rowsKey: 'productos',
      title: 'Maestra de Productos',
      eyebrow: 'Base maestra · Productos',
      head: 'Mantenedor · Productos',
      sub: 'Administra el catalogo de productos. La gestion por sala se define en Local-Producto.',
      count: 'productos',
      add: 'Agregar producto',
      bulk: 'Carga masiva',
      cols: ['Cadena', 'Cliente', 'Cod. producto', 'Nombre producto', 'EAN', 'Un/Caja', 'Marca', 'Seccion', 'Rubro', 'Subrubro', 'Categoria', 'Estado', 'Cat. tareas', 'Acciones'],
      filters: [
        ['cadena', 'Cadena'],
        ['cliente', 'Cliente'],
        ['codigo_producto', 'Cod. Producto'],
        ['nombre', 'Nombre Producto'],
        ['categoria', 'Categoria'],
        ['estado', 'Estado'],
      ],
    },
    localproducto: {
      path: 'local-producto',
      rowsKey: 'relaciones',
      title: 'Maestra Local-Producto',
      eyebrow: 'Base maestra · Local-Producto',
      head: 'Mantenedor · Local-Producto',
      sub: 'Define que productos se gestionan en cada sala. Esta relacion alimenta la app movil.',
      count: 'relaciones',
      add: 'Asignar relacion',
      bulk: 'Carga masiva',
      cols: ['Cadena', 'Cliente', 'Cod. local llave', 'Local', 'Cod. producto', 'Producto', 'Lo gestionamos', 'Acciones'],
      filters: [
        ['cadena', 'Cadena'],
        ['cliente', 'Cliente'],
        ['codigo_local', 'Codigo Local'],
        ['nombre_local', 'Nombre Local'],
        ['codigo_producto', 'Cod. Producto'],
        ['lo_gestionamos', '¿Lo gestionamos?'],
      ],
    },
  };

  const def = pageDefs[mode] || pageDefs.locales;
  const state = {
    page: 1,
    limit: 12,
    allRows: [],
    rows: [],
    options: { clientes: [], cadenas: [], rutas: [] },
    filters: {},
    editing: null,
    solicitudes: [],
  };

  function injectMaintainerStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .re-filters{display:flex!important;flex-wrap:wrap;align-items:center;gap:12px;margin:34px 0 22px}
      .re-filters .re-filter-label{flex:0 0 auto;margin-right:2px}
      .re-filters .re-select{width:auto!important;min-width:150px;max-width:270px;flex:0 0 auto;padding:0 20px}
      .re-filters .re-filter-actions{display:flex;flex:0 0 auto;gap:10px;grid-column:auto;width:auto}
      .re-filters .re-filter-actions .re-btn{min-height:48px;white-space:nowrap}
      .re-table th:first-child,.re-table td:first-child{min-width:145px}
      @media(max-width:980px){
        .re-filters .re-select{flex:1 1 210px;max-width:none}
        .re-filters .re-filter-actions{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function initShell() {
    $('#head-title').textContent = def.head;
    $('#eyebrow').textContent = def.eyebrow;
    $('#page-title').textContent = def.title;
    $('#page-sub').textContent = def.sub;
    $('#add').innerHTML = '+ ' + def.add;
    $('#bulk').innerHTML = '↑ ' + def.bulk;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function qs(params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    const str = query.toString();
    return str ? '?' + str : '';
  }

  function isTrue(value) {
    return value === true || value === 1 || value === '1' || value === 'true' || value === 'si';
  }

  function yes(value) {
    return isTrue(value) ? '<span class="re-ok">✓</span>' : '<span class="re-dash">-</span>';
  }

  function rowId(row) {
    return row.id ?? row.codigo_local ?? row.id_local ?? row.codigo_producto;
  }

  function rowValue(row, key) {
    if (key === 'codigo') return row.codigo_local || row.id || row.id_local;
    if (key === 'codigo_local') return row.codigo_local || row.id_local || row.id;
    if (key === 'local') return row.nombre_local || row.nombre;
    if (key === 'lo_cubrimos') return isTrue(row.lo_cubrimos) ? 'si' : 'no';
    if (key === 'lo_gestionamos') return isTrue(row.lo_gestionamos) ? 'si' : 'no';
    return row[key];
  }

  function uniqueOptions(key) {
    if (key === 'lo_cubrimos') return [['si', 'Si'], ['no', 'No']];
    if (key === 'lo_gestionamos') return [['si', 'Si'], ['no', 'No']];
    if (key === 'cliente' && state.options.clientes.length) {
      const values = state.options.clientes.map((cliente) => [cliente.nombre, cliente.nombre]);
      return values.sort((a, b) => a[1].localeCompare(b[1], 'es'));
    }
    const map = new Map();
    state.allRows.forEach((row) => {
      const value = rowValue(row, key);
      if (value !== undefined && value !== null && value !== '') map.set(String(value), String(value));
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es', { numeric: true }));
  }

  function buildFilters() {
    const html = [
      '<span class="re-filter-label">Filtrar por</span>',
      ...def.filters.map(([key, label]) => selectFilter(key, label)),
      '<div class="re-filter-actions">',
      '<button class="re-btn re-btn-outline" id="apply" type="button">Aplicar filtros</button>',
      '<button class="re-btn" id="clear" type="button" disabled>Limpiar filtros</button>',
      '</div>',
    ].join('');

    $('#filters').classList.remove('re-route-filters');
    $('#filters').innerHTML = html;
    $('#apply').onclick = () => {
      state.page = 1;
      render();
    };
    $('#clear').onclick = () => {
      state.filters = {};
      $$('[data-filter]').forEach((select) => { select.value = ''; });
      state.page = 1;
      render();
    };
    $$('[data-filter]').forEach((select) => {
      select.onchange = (event) => {
        state.filters[event.target.dataset.filter] = event.target.value;
      };
    });
  }

  function selectFilter(key, label) {
    const selected = state.filters[key] || '';
    const options = uniqueOptions(key).map(([value, text]) => '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(text) + '</option>').join('');
    return '<select class="re-select" data-filter="' + esc(key) + '"><option value="">' + esc(label) + '</option>' + options + '</select>';
  }

  async function loadOptions() {
    try {
      state.options = await API.requestJson(base + '/opciones');
    } catch (error) {
      state.options = { clientes: [], cadenas: [], rutas: [] };
    }
  }

  async function load() {
    setLoading(true);
    try {
      const data = await API.requestJson(base + '/' + def.path + qs({ page: 1, limit: 1000 }));
      state.allRows = data[def.rowsKey] || [];
      state.rows = state.allRows;
      if (mode === 'localproducto') await loadSolicitudes();
      buildFilters();
      render();
    } catch (error) {
      toast('No se pudo cargar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSolicitudes() {
    try {
      const data = await API.requestJson(base + '/solicitudes' + qs({ estado: 'pendiente' }));
      state.solicitudes = data.solicitudes || [];
    } catch (error) {
      state.solicitudes = [];
    }
  }

  function filtered() {
    return state.allRows.filter((row) => {
      return Object.entries(state.filters).every(([key, selected]) => {
        if (!selected) return true;
        return String(rowValue(row, key) || '').toLowerCase() === String(selected).toLowerCase();
      });
    });
  }

  function render() {
    const rows = filtered();
    const active = Object.values(state.filters).filter(Boolean).length;
    const clear = $('#clear');
    if (clear) clear.disabled = !active;

    const pages = Math.max(1, Math.ceil(rows.length / state.limit));
    if (state.page > pages) state.page = pages;

    const start = (state.page - 1) * state.limit;
    const pageRows = rows.slice(start, start + state.limit);
    const managed = mode === 'localproducto' ? ' · <b class="re-green">' + rows.filter((row) => isTrue(row.lo_gestionamos)).length + ' gestionadas</b>' : '';
    $('#summary').innerHTML = 'Mostrando <b>' + rows.length + '</b> de ' + state.allRows.length + ' ' + def.count + managed;
    renderTable(pageRows);
    $('#pager-info').textContent = (rows.length ? (start + 1) + '-' + (start + pageRows.length) : '0') + ' de ' + rows.length;
    $('#page-info').textContent = 'Pagina ' + state.page + ' / ' + pages;
    $('#prev').disabled = state.page <= 1;
    $('#next').disabled = state.page >= pages;
    renderSolicitudes();
  }

  function renderTable(rows) {
    $('#thead').innerHTML = '<tr>' + def.cols.map((col) => '<th>' + esc(col) + '</th>').join('') + '</tr>';
    $('#tbody').innerHTML = rows.length
      ? rows.map(rowHtml).join('')
      : '<tr><td class="re-empty" colspan="' + def.cols.length + '">No hay ' + def.count + ' que coincidan con la busqueda o los filtros.</td></tr>';
    bindRowButtons();
  }

  function rowHtml(row) {
    if (mode === 'locales') {
      return '<tr>'
        + '<td class="re-sticky"><span class="re-pill">' + esc(row.cadena) + '</span></td>'
        + '<td><button class="re-link" data-edit="' + esc(rowId(row)) + '">' + esc(row.codigo_local || row.id) + '</button></td>'
        + '<td><span class="re-pill re-soft">' + esc(row.formato) + '</span></td>'
        + '<td><b>' + esc(row.nombre) + '</b></td>'
        + '<td>' + esc(row.region) + '</td>'
        + '<td>' + esc(row.comuna) + '</td>'
        + '<td>' + esc(row.direccion) + '</td>'
        + '<td>' + yes(row.lo_cubrimos) + '</td>'
        + actions(rowId(row))
        + '</tr>';
    }

    if (mode === 'productos') {
      return '<tr>'
        + '<td class="re-sticky"><span class="re-pill">' + esc(row.cadena) + '</span></td>'
        + '<td>' + esc(row.cliente) + '</td>'
        + '<td><b>' + esc(row.codigo_producto) + '</b></td>'
        + '<td><b>' + esc(row.nombre) + '</b></td>'
        + '<td>' + esc(row.ean) + '</td>'
        + '<td>' + esc(row.un_x_caja) + '</td>'
        + '<td>' + esc(row.marca) + '</td>'
        + '<td>' + esc(row.seccion) + '</td>'
        + '<td>' + esc(row.rubro) + '</td>'
        + '<td>' + esc(row.subrubro) + '</td>'
        + '<td>' + esc(row.categoria) + '</td>'
        + '<td>' + esc(row.estado) + '</td>'
        + '<td>' + esc(row.categoria_tareas) + '</td>'
        + actions(rowId(row))
        + '</tr>';
    }

    return '<tr>'
      + '<td class="re-sticky"><span class="re-pill">' + esc(row.cadena) + '</span></td>'
      + '<td>' + esc(row.cliente) + '</td>'
      + '<td><b>' + esc(row.id_local || row.codigo_local) + '</b></td>'
      + '<td><b>' + esc(row.nombre_local) + '</b></td>'
      + '<td>' + esc(row.codigo_producto) + '</td>'
      + '<td>' + esc(row.producto) + '</td>'
      + '<td>' + yes(row.lo_gestionamos) + '</td>'
      + actions(rowId(row))
      + '</tr>';
  }

  function actions(id) {
    return '<td><button class="re-icon" data-edit="' + esc(id) + '" title="Editar">✎</button> <button class="re-icon re-icon-danger" data-del="' + esc(id) + '" title="Eliminar">⌧</button></td>';
  }

  function bindRowButtons() {
    $$('[data-edit]').forEach((button) => { button.onclick = () => openEdit(button.dataset.edit); });
    $$('[data-del]').forEach((button) => { button.onclick = () => softDelete(button.dataset.del); });
  }

  function findRow(id) {
    return state.allRows.find((row) => String(rowId(row)) === String(id) || String(row.id) === String(id));
  }

  function openAdd() {
    state.editing = null;
    openModal();
  }

  function openEdit(id) {
    state.editing = findRow(id);
    openModal();
  }

  function closeModal() {
    $('#modal').classList.remove('is-open');
    state.editing = null;
  }

  function openModal() {
    const row = state.editing || {};
    $('#modal-title').textContent = state.editing ? 'Editar' : 'Crear';
    let html = '';

    if (mode === 'locales') {
      html = input('id', 'Codigo local', 'text', row.codigo_local || row.id)
        + input('cadena', 'Cadena', 'text', row.cadena)
        + input('formato', 'Formato', 'text', row.formato)
        + input('nombre', 'Nombre local', 'text', row.nombre)
        + input('region', 'Region', 'text', row.region)
        + input('comuna', 'Comuna', 'text', row.comuna)
        + '<label class="re-field re-span"><span>Direccion</span><input name="direccion" value="' + esc(row.direccion) + '"></label>'
        + selectInput('lo_cubrimos', 'Lo cubrimos', [['true', 'Si'], ['false', 'No']], String(isTrue(row.lo_cubrimos)));
    }

    if (mode === 'productos') {
      html = input('cadena', 'Cadena', 'text', row.cadena)
        + selectInput('id_cliente', 'Cliente', state.options.clientes.map((cliente) => [cliente.id, cliente.nombre]), row.id_cliente)
        + input('codigo_producto', 'Codigo producto', 'text', row.codigo_producto)
        + input('nombre', 'Nombre producto', 'text', row.nombre)
        + input('ean', 'EAN', 'text', row.ean)
        + input('un_x_caja', 'Un/Caja', 'text', row.un_x_caja)
        + input('marca', 'Marca', 'text', row.marca)
        + input('seccion', 'Seccion', 'text', row.seccion)
        + input('rubro', 'Rubro', 'text', row.rubro)
        + input('subrubro', 'Subrubro', 'text', row.subrubro)
        + input('categoria', 'Categoria', 'text', row.categoria)
        + input('estado', 'Estado', 'text', row.estado || 'Activo')
        + input('categoria_tareas', 'Categoria tareas', 'text', row.categoria_tareas);
    }

    if (mode === 'localproducto') {
      html = input('id_local', 'Codigo local', 'text', row.id_local)
        + input('id_producto', 'ID producto', 'number', row.id_producto)
        + selectInput('lo_gestionamos', 'Lo gestionamos', [['true', 'Si'], ['false', 'No']], String(isTrue(row.lo_gestionamos)));
    }

    $('#modal-fields').innerHTML = html;
    $('#modal').classList.add('is-open');
  }

  function input(name, label, type, value) {
    return '<label class="re-field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" type="' + esc(type) + '" value="' + esc(value) + '"></label>';
  }

  function selectInput(name, label, options, value) {
    return '<label class="re-field"><span>' + esc(label) + '</span><select name="' + esc(name) + '">'
      + options.map(([optionValue, text]) => '<option value="' + esc(optionValue) + '"' + (String(optionValue) === String(value) ? ' selected' : '') + '>' + esc(text) + '</option>').join('')
      + '</select></label>';
  }

  async function save(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target).entries());
    try {
      setLoading(true);
      if (mode === 'locales') {
        form.lo_cubrimos = form.lo_cubrimos === 'true';
        await sendSave('locales', state.editing && rowId(state.editing), form);
      }
      if (mode === 'productos') {
        await sendSave('productos', state.editing && rowId(state.editing), form);
      }
      if (mode === 'localproducto') {
        form.id_producto = Number(form.id_producto);
        form.lo_gestionamos = form.lo_gestionamos === 'true';
        await sendSave('local-producto', state.editing && rowId(state.editing), form);
      }
      closeModal();
      await load();
      toast('Guardado correctamente');
    } catch (error) {
      toast('No se pudo guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendSave(path, id, body) {
    const url = base + '/' + path + (id ? '/' + encodeURIComponent(id) : '');
    return API.requestJson(url, {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    });
  }

  async function softDelete(id) {
    const row = findRow(id);
    if (!row || !confirm('¿Seguro que quieres eliminar este registro?')) return;
    try {
      setLoading(true);
      if (mode === 'locales') await sendSave('locales', rowId(row), { ...row, id: row.codigo_local || row.id, lo_cubrimos: false });
      if (mode === 'productos') await sendSave('productos', rowId(row), { ...row, estado: 'Inactivo' });
      if (mode === 'localproducto') await sendSave('local-producto', rowId(row), { lo_gestionamos: false });
      await load();
      toast('Registro desactivado');
    } catch (error) {
      toast('No se pudo eliminar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function renderSolicitudes() {
    const box = $('#solicitudes');
    if (!box) return;
    if (mode !== 'localproducto' || !state.solicitudes.length) {
      box.classList.remove('is-on');
      box.innerHTML = '';
      return;
    }
    box.classList.add('is-on');
    box.innerHTML = '<b>Solicitudes pendientes</b>' + state.solicitudes.map((solicitud) => (
      '<div class="re-solicitud"><div><b>' + esc(solicitud.tipo) + ' cliente ' + esc(solicitud.cliente) + '</b><div class="re-small">' + esc(solicitud.id_local) + ' · ' + esc(solicitud.nombre_local || '') + '</div></div><span><button class="re-btn re-btn-purple" data-sol-ok="' + esc(solicitud.id) + '">Aprobar</button> <button class="re-btn" data-sol-no="' + esc(solicitud.id) + '">Rechazar</button></span></div>'
    )).join('');
    $$('[data-sol-no]').forEach((button) => { button.onclick = () => resolveSolicitud(button.dataset.solNo, 'rechazar'); });
    $$('[data-sol-ok]').forEach((button) => { button.onclick = () => approveSolicitud(button.dataset.solOk); });
  }

  async function approveSolicitud(id) {
    const solicitud = state.solicitudes.find((item) => String(item.id) === String(id));
    if (!solicitud) return;
    if (solicitud.tipo !== 'agregar') return resolveSolicitud(id, 'aprobar', []);
    try {
      setLoading(true);
      const data = await API.requestJson(base + '/productos' + qs({ cliente: solicitud.cliente, limit: 500 }));
      const productos = data.productos || [];
      $('#modal-title').textContent = 'Aprobar solicitud';
      $('#modal-fields').innerHTML = '<div class="re-span"><p style="margin:0 0 14px;color:#6b6557;font-weight:700">Selecciona los productos que se activaran para ' + esc(solicitud.cliente) + ' en ' + esc(solicitud.id_local) + ' · ' + esc(solicitud.nombre_local || '') + '.</p><div style="max-height:360px;overflow:auto;border:1px solid rgba(28,26,20,.12);border-radius:14px;padding:10px;background:#fff">' + productos.map((producto) => '<label style="display:flex;gap:10px;align-items:flex-start;padding:8px;border-bottom:1px solid rgba(28,26,20,.06)"><input type="checkbox" name="producto_ids" value="' + esc(producto.id) + '"><span><b>' + esc(producto.codigo_producto || producto.id) + '</b> · ' + esc(producto.nombre || '') + '<br><small style="color:#6b6557">' + esc(producto.categoria || '') + '</small></span></label>').join('') + '</div></div>';
      const restore = () => {
        closeModal();
        $('#modal-form').onsubmit = save;
        $('#modal-cancel').onclick = closeModal;
        $('#modal-close').onclick = closeModal;
      };
      $('#modal-form').onsubmit = async (event) => {
        event.preventDefault();
        const productIds = $$('#modal input[name="producto_ids"]:checked').map((input) => Number(input.value)).filter(Boolean);
        if (!productIds.length) {
          toast('Selecciona al menos un producto');
          return;
        }
        restore();
        await resolveSolicitud(id, 'aprobar', productIds);
      };
      $('#modal-cancel').onclick = restore;
      $('#modal-close').onclick = restore;
      $('#modal').classList.add('is-open');
    } catch (error) {
      toast('No se pudo cargar productos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function resolveSolicitud(id, accion, productoIds) {
    try {
      setLoading(true);
      await API.requestJson(base + '/solicitudes/' + encodeURIComponent(id) + '/resolver', {
        method: 'PATCH',
        body: JSON.stringify({ accion, producto_ids: productoIds || [] }),
      });
      await load();
      toast('Solicitud actualizada');
    } catch (error) {
      toast('No se pudo actualizar solicitud: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(active) {
    document.body.classList.toggle('re-loading', active);
  }

  function toast(message) {
    const box = $('#toast');
    box.textContent = message;
    box.classList.add('is-on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove('is-on'), 3200);
  }

  function wire() {
    injectMaintainerStyles();
    initShell();
    buildFilters();
    $('#add').onclick = openAdd;
    $('#modal-close').onclick = closeModal;
    $('#modal-cancel').onclick = closeModal;
    $('#modal-form').onsubmit = save;
    $('#prev').onclick = () => {
      state.page -= 1;
      render();
    };
    $('#next').onclick = () => {
      state.page += 1;
      render();
    };
  }

  wire();
  loadOptions().then(load);
})();
