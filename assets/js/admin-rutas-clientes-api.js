(function () {
  'use strict';

  var API = window.RetailAPI;
  if (!API) return;

  var state = { rows: [], clients: [], routes: [], filters: {}, current: null, draft: null, history: [], asigByLocal: null, usuarios: [] };
  var DAY_ORDER = ['l', 'm', 'x', 'j', 'v', 's', 'd'];
  var DAY_LABELS = { l: 'L', m: 'M', x: 'X', j: 'J', v: 'V', s: 'S', d: 'D' };
  var DAY_NUMBERS = { l: '1', m: '2', x: '3', j: '4', v: '5', s: '6', d: '7' };
  var DAY_KEYS_BY_TOKEN = { '1': 'l', '2': 'm', '3': 'x', '4': 'j', '5': 'v', '6': 's', '7': 'd', l: 'l', m: 'm', x: 'x', j: 'j', v: 'v', s: 's', d: 'd' };
  var tbody = document.getElementById('tbody');
  var filters = document.getElementById('filters');
  var resultCount = document.getElementById('resultCount');
  var editOverlay = document.getElementById('editOverlay');
  var routesHost = document.getElementById('m-routes');
  var toastNode = document.getElementById('toast');

  function text(value) { return String(value == null ? '' : value); }
  function esc(value) { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function title(value) { return text(value).toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function routeLabel(value) { return /^rm\s*\d+$/i.test(text(value)) ? text(value).toUpperCase().replace(/\s/g, '') : title(value); }
  function daysObject(value) {
    var out = {};
    text(value).toLowerCase().split(/[-,\s]+/).forEach(function (token) {
      var day = DAY_KEYS_BY_TOKEN[token];
      if (day) out[day] = true;
    });
    return out;
  }
  function daysString(days) { return DAY_ORDER.filter(function (day) { return days[day]; }).map(function (day) { return DAY_NUMBERS[day]; }).join(','); }
  function normalizedDaysString(value) { return daysString(daysObject(value)); }
  function clientIds(row) { return (row.clientes || []).map(function (client) { return Number(client.id); }); }
  function activeRows() { return state.rows.filter(function (row) { return unionClientIds(row).length > 0; }); }
  function toast(message, isError) {
    toastNode.textContent = message;
    toastNode.style.background = isError ? '#9f2d20' : '';
    toastNode.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toastNode.classList.remove('show'); }, 3200);
  }
  function errorMessage(error) {
    var raw = error && error.message ? error.message : 'No se pudo completar la operación';
    try { var parsed = JSON.parse(raw); return parsed.message || raw; } catch (_) { return raw; }
  }

  /* ---- Asignaciones multi-reponedor (asignacion_visita + asignacion_visita_cliente) ----
     state.asigByLocal[id_local] = [{id, id_usuario, reponedor, rut, ruta, tipo, dias_visita,
     origen_tipo, clientes:{modo,lista}}]. Si el endpoint no existe (backend antiguo) queda
     null y el modal cae al flujo clásico de un reponedor por local. */
  function asigsFor(idLocal) { return (state.asigByLocal && state.asigByLocal[idLocal]) || []; }
  function asigClientIds(asig) { return ((asig.clientes && asig.clientes.lista) || []).map(function (c) { return Number(c.id); }); }
  function unionDaysString(row) {
    var asigs = asigsFor(row.id);
    if (!asigs.length) return normalizedDaysString(row.dias_visita);
    var union = {};
    asigs.forEach(function (asig) { var days = daysObject(asig.dias_visita); DAY_ORDER.forEach(function (d) { if (days[d]) union[d] = true; }); });
    return daysString(union);
  }
  function unionClientIds(row) {
    var asigs = asigsFor(row.id);
    if (!asigs.length) return clientIds(row);
    var seen = {};
    asigs.forEach(function (asig) { asigClientIds(asig).forEach(function (id) { seen[id] = true; }); });
    return Object.keys(seen).map(Number);
  }

  function cloneDraft(row) {
    var selected = {};
    unionClientIds(row).forEach(function (id) { selected[id] = true; });
    var reps = asigsFor(row.id).map(function (asig) {
      var sel = {};
      asigClientIds(asig).forEach(function (id) { sel[id] = true; });
      return { id: asig.id, rut: asig.rut, nombre: asig.reponedor, ruta: asig.ruta, tipo: asig.tipo, origen: asig.origen_tipo, days: daysObject(asig.dias_visita), sel: sel, modoTodos: !!(asig.clientes && asig.clientes.modo === 'todos'), removed: false };
    });
    return { ruta: row.ruta || '', days: daysObject(row.dias_visita), clients: selected, reps: reps, newReps: [] };
  }

  function loadAllPages(page, accumulated) {
    return API.requestJson('/web/admin/mantenedores/rutas?limit=1000&page=' + page).then(function (payload) {
      var rows = accumulated.concat(payload.rutas || []);
      return rows.length < Number(payload.total || 0) ? loadAllPages(page + 1, rows) : rows;
    });
  }
  function loadAllAsignaciones(page, accumulated) {
    return API.requestJson('/web/admin/asignaciones?limit=500&page=' + page).then(function (payload) {
      var rows = accumulated.concat(payload.asignaciones || []);
      return rows.length < Number(payload.total || 0) ? loadAllAsignaciones(page + 1, rows) : rows;
    });
  }

  function load() {
    resultCount.textContent = 'Cargando rutas desde el backend…';
    return Promise.all([
      loadAllPages(1, []),
      API.requestJson('/web/admin/mantenedores/opciones'),
      loadAllAsignaciones(1, []).catch(function () { return null; }),
      API.requestJson('/web/admin/asignaciones/opciones').catch(function () { return null; })
    ])
      .then(function (result) {
        state.rows = result[0];
        state.clients = result[1].clientes || [];
        state.routes = result[1].rutas || [];
        if (result[2]) {
          state.asigByLocal = {};
          result[2].forEach(function (asig) {
            (state.asigByLocal[asig.id_local] = state.asigByLocal[asig.id_local] || []).push(asig);
          });
        } else {
          state.asigByLocal = null;
        }
        state.usuarios = (result[3] && result[3].usuarios) || [];
        buildHead(); buildFilters(); render();
      }).catch(function (error) {
        tbody.innerHTML = '<tr><td colspan="7">No fue posible cargar las rutas: ' + esc(errorMessage(error)) + '</td></tr>';
        resultCount.textContent = 'Error de conexión';
        toast(errorMessage(error), true);
      });
  }

  function buildHead() {
    var columns = ['Cadena', 'Código Local', 'Nombre Local', 'Días', 'Frec.', 'Ruta', state.asigByLocal ? 'Reponedores' : 'RUT'];
    document.getElementById('theadRow').innerHTML = columns.map(function (label, index) {
      return '<th' + (index < 3 ? ' class="sticky-col c' + index + '"' : '') + '>' + label + '</th>';
    }).join('') + state.clients.map(function (client) { return '<th class="client-col">' + esc(client.nombre) + '</th>'; }).join('');
  }

  function unique(field) {
    var values = {};
    activeRows().forEach(function (row) { var value = row[field]; if (value) values[value] = true; });
    return Object.keys(values).sort(function (a, b) { return a.localeCompare(b, 'es', { numeric: true }); });
  }
  function buildFilters() {
    filters.innerHTML = '<span class="flabel">Filtrar por</span>';
    [
      ['cadena', 'Cadena', unique('cadena')], ['id', 'Código Local Llave', unique('id')],
      ['nombre', 'Nombre Local', unique('nombre')], ['ruta', 'Ruta', state.routes.map(function (r) { return r.ruta; })],
      ['cliente', 'Cliente', state.clients.map(function (c) { return String(c.id); })]
    ].forEach(function (definition) {
      var key = definition[0], label = definition[1], options = definition[2];
      state.filters[key] = [];
      var wrap = document.createElement('div');
      wrap.className = 'filter-wrap';
      var button = document.createElement('button');
      button.className = 'filter'; button.type = 'button';
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<span>' + label + '</span><span class="chev" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>';
      var dropdown = document.createElement('div'); dropdown.className = 'dropdown';
      dropdown.innerHTML = '<input class="dd-search" type="text" placeholder="Buscar ' + label.toLowerCase() + '…"><div class="dd-list">' + options.map(function (value) {
        var shown = key === 'cliente' ? (state.clients.find(function (c) { return String(c.id) === value; }) || {}).nombre : value;
        return '<label class="dd-item"><input type="checkbox" value="' + esc(value) + '"><span>' + esc(shown) + '</span></label>';
      }).join('') + '</div>';
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        document.querySelectorAll('.filter-wrap.open').forEach(function (node) { if (node !== wrap) node.classList.remove('open'); });
        wrap.classList.toggle('open');
        button.setAttribute('aria-expanded', wrap.classList.contains('open') ? 'true' : 'false');
      });
      dropdown.addEventListener('click', function (event) { event.stopPropagation(); });
      dropdown.addEventListener('change', function () {
        state.filters[key] = Array.prototype.slice.call(dropdown.querySelectorAll('input[type="checkbox"]:checked')).map(function (input) { return input.value; });
        button.classList.toggle('has-selection', state.filters[key].length > 0);
        var count = button.querySelector('.count');
        if (state.filters[key].length) {
          if (!count) { count = document.createElement('span'); count.className = 'count'; button.appendChild(count); }
          count.textContent = state.filters[key].length;
        } else if (count) count.remove();
        if (pager) pager.reset();
        render();
      });
      dropdown.querySelector('.dd-search').addEventListener('input', function (event) {
        var query = event.target.value.toLowerCase().trim();
        dropdown.querySelectorAll('.dd-item').forEach(function (item) {
          var match = item.textContent.toLowerCase().indexOf(query) >= 0;
          item.style.display = match ? 'flex' : 'none';
          var cb = item.querySelector('input[type="checkbox"]');
          if (!cb) return;
          if (query && match && !cb.checked) { cb.checked = true; cb.setAttribute('data-auto', '1'); }
          else if (cb.getAttribute('data-auto') === '1' && (!query || !match)) { cb.checked = false; cb.removeAttribute('data-auto'); }
        });
        dropdown.dispatchEvent(new Event('change'));
      });
      wrap.appendChild(button); wrap.appendChild(dropdown); filters.appendChild(wrap);
    });
  }
  function matches(row) {
    return (!state.filters.cadena.length || state.filters.cadena.indexOf(row.cadena) >= 0) &&
      (!state.filters.id.length || state.filters.id.indexOf(row.id) >= 0) &&
      (!state.filters.nombre.length || state.filters.nombre.indexOf(row.nombre) >= 0) &&
      (!state.filters.ruta.length || state.filters.ruta.indexOf(row.ruta) >= 0) &&
      (!state.filters.cliente.length || state.filters.cliente.some(function (id) { return unionClientIds(row).indexOf(Number(id)) >= 0; }));
  }
  var pager = window.createREPager ? createREPager('#pager', { pageSize: 100, onChange: function () { render(); }, scrollTo: '.table-card' }) : null;
  function render() {
    var active = activeRows();
    var rows = active.filter(matches);
    var visible = pager ? pager.slice(rows) : rows;
    var check = '<span class="visit-yes">✓</span>';
    tbody.innerHTML = visible.length ? visible.map(function (row) {
      var ids = unionClientIds(row);
      var asigs = asigsFor(row.id);
      var days = unionDaysString(row);
      var rutaShown = row.ruta || (asigs.length ? asigs[0].ruta : '');
      // Con un solo reponedor se muestra su RUT; con varios, el conteo (el detalle vive en el modal).
      var repCell = asigs.length > 1
        ? '<span class="rep-count">' + asigs.length + ' reponedores</span>'
        : esc((asigs[0] && asigs[0].rut) || row.rut || '—');
      return '<tr><td class="sticky-col c0">' + esc(title(row.cadena)) + '</td>' +
        '<td class="sticky-col c1 codigo editable" data-local="' + esc(row.id) + '">' + esc(row.id) + '</td>' +
        '<td class="sticky-col c2 nombre editable" data-local="' + esc(row.id) + '">' + esc(title(row.nombre)) + '</td>' +
        '<td class="dias">' + (days ? esc(days) : '—') + '</td>' +
        '<td><span class="freq">' + (days ? days.split(',').length : 0) + '</span></td>' +
        '<td>' + (rutaShown ? '<span class="ruta-badge">' + esc(routeLabel(rutaShown)) + '</span>' : '<span class="visit-no">Sin ruta</span>') + '</td>' +
        '<td style="color:var(--muted)">' + repCell + '</td>' +
        state.clients.map(function (client) { return '<td class="client-col">' + (ids.indexOf(Number(client.id)) >= 0 ? check : '<span class="visit-no">–</span>') + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr class="empty-row"><td colspan="' + (7 + state.clients.length) + '">No hay salas que coincidan con los filtros.</td></tr>';
    resultCount.innerHTML = 'Mostrando <b>' + rows.length + '</b> de ' + active.length + ' salas';
  }

  function openEdit(id) {
    state.current = state.rows.find(function (row) { return row.id === id; });
    if (!state.current) return;
    state.draft = cloneDraft(state.current);
    document.getElementById('m-cadena').textContent = title(state.current.cadena);
    document.getElementById('m-nombre').textContent = title(state.current.nombre);
    document.getElementById('m-codigo').textContent = state.current.id;
    document.getElementById('m-add-route').style.display = 'none';
    renderEditor(); editOverlay.classList.add('open');
  }

  function dayButtonsHtml(days, attr) {
    return DAY_ORDER.map(function (day) {
      return '<button type="button" class="day-toggle' + (days[day] ? ' on' : '') + '" ' + attr + ' data-day="' + day + '">' + DAY_LABELS[day] + '</button>';
    }).join('');
  }
  function localClientList(draft) {
    return state.clients.filter(function (client) { return draft.clients[client.id]; });
  }
  function repCardHtml(rep, index) {
    var enabled = localClientList(state.draft);
    var tipoTag = rep.tipo ? '<span class="rep-tag">' + esc(title(rep.tipo)) + '</span>' : '';
    var rutaTag = rep.ruta ? '<span class="ruta-badge">' + esc(routeLabel(rep.ruta)) + '</span>' : '';
    var allSelected = enabled.length && enabled.every(function (client) { return rep.sel[client.id]; });
    return '<div class="rep-card' + (rep.removed ? ' removed' : '') + '" data-rep="' + index + '">' +
      '<div class="rep-head"><span class="rep-name">' + esc(title(rep.nombre || '')) + '</span>' +
      '<span class="rep-rut">' + esc(rep.rut || '') + '</span>' + tipoTag + rutaTag +
      (rep.removed
        ? '<button type="button" class="rep-undo" data-rep-undo="' + index + '">Deshacer</button>'
        : '<button type="button" class="rep-remove" data-rep-remove="' + index + '" title="Quitar reponedor del local"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12a2 2 0 0 1-2 1.9H7.7a2 2 0 0 1-2-1.9L5 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg> Quitar</button>') +
      '</div>' +
      (rep.removed ? '' :
        '<div class="edit-block"><span class="block-label">Días de visita</span><div class="days">' + dayButtonsHtml(rep.days, 'data-rep-day="' + index + '"') + '</div></div>' +
        '<div class="edit-block"><span class="block-label">Marcas que atiende</span><div class="clients-grid">' +
        enabled.map(function (client) { var on = !!rep.sel[client.id]; return '<button type="button" class="client-chip' + (on ? ' on' : '') + '" data-rep-client="' + index + ':' + client.id + '"><span class="chip-ico">' + (on ? '✓' : '+') + '</span>' + esc(client.nombre) + '</button>'; }).join('') +
        '</div><p class="rut-hint">' + (allSelected || !Object.keys(rep.sel).some(function (k) { return rep.sel[k]; }) ? 'Con todas las marcas seleccionadas, el reponedor ve todas las marcas habilitadas del local (incluye las que se agreguen a futuro).' : 'Ve solo las marcas seleccionadas.') + '</p></div>') +
      '</div>';
  }
  function renderEditor() {
    var draft = state.draft;
    var html = '<div class="route-block"><div class="route-block-head"><span class="route-num">Ruta del local</span></div>' +
      '<div class="edit-grid"><div class="edit-field"><label>Ruta</label><select class="edit-input edit-select" id="route-select"><option value="">Sin ruta</option>' +
      state.routes.map(function (route) { return '<option value="' + esc(route.ruta) + '"' + (route.ruta === draft.ruta ? ' selected' : '') + '>' + esc(routeLabel(route.ruta)) + '</option>'; }).join('') +
      '</select></div>' +
      (state.asigByLocal ? '' : '<div class="edit-field"><label>RUT reponedor</label><div class="rut-display">' + esc(state.current.rut || '—') + '</div><p class="rut-hint">Asignado por el backend</p></div>') +
      '</div>' +
      (state.asigByLocal ? '' : '<div class="edit-block"><span class="block-label">Días de visita</span><div class="days">' + dayButtonsHtml(draft.days, 'data-local-day="1"') + '</div></div>') +
      '<div class="edit-block"><span class="block-label">Marcas habilitadas en el local</span><div class="clients-grid">' +
      state.clients.map(function (client) { var on = !!draft.clients[client.id]; return '<button type="button" class="client-chip' + (on ? ' on' : '') + '" data-client="' + client.id + '"><span class="chip-ico">' + (on ? '✓' : '+') + '</span>' + esc(client.nombre) + '</button>'; }).join('') +
      '</div></div></div>';

    if (state.asigByLocal) {
      var visibles = draft.reps.length + draft.newReps.length;
      html += '<div class="rep-section"><div class="route-block-head"><span class="route-num">Reponedores del local (' + visibles + ')</span></div><div class="rep-list">' +
        (draft.reps.length ? draft.reps.map(function (rep, index) { return repCardHtml(rep, index); }).join('') : '<p class="rep-empty">Este local aún no tiene reponedores asignados.</p>') +
        draft.newReps.map(function (rep, index) {
          var enabled = localClientList(draft);
          return '<div class="rep-card rep-new" data-new="' + index + '"><div class="rep-head"><span class="rep-name">' + esc(title(rep.nombre)) + '</span><span class="rep-rut">' + esc(rep.rut) + '</span><span class="rep-tag rep-tag-new">Nuevo</span>' +
            '<button type="button" class="rep-remove" data-new-remove="' + index + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Descartar</button></div>' +
            '<div class="edit-block"><span class="block-label">Días de visita</span><div class="days">' + dayButtonsHtml(rep.days, 'data-new-day="' + index + '"') + '</div></div>' +
            '<div class="edit-block"><span class="block-label">Marcas que atiende</span><div class="clients-grid">' +
            enabled.map(function (client) { var on = !!rep.sel[client.id]; return '<button type="button" class="client-chip' + (on ? ' on' : '') + '" data-new-client="' + index + ':' + client.id + '"><span class="chip-ico">' + (on ? '✓' : '+') + '</span>' + esc(client.nombre) + '</button>'; }).join('') +
            '</div></div></div>';
        }).join('') +
        '</div>' +
        '<div class="rep-add-row"><select class="edit-input edit-select" id="rep-add-select"><option value="">Agregar reponedor…</option>' +
        state.usuarios.filter(function (usuario) {
          if (text(usuario.estado).toLowerCase() === 'inactivo') return false;
          var used = draft.reps.some(function (rep) { return !rep.removed && rep.rut === usuario.rut; }) ||
            draft.newReps.some(function (rep) { return rep.rut === usuario.rut; });
          return !used;
        }).map(function (usuario) { return '<option value="' + esc(usuario.rut) + '">' + esc(title(usuario.nombre) + ' · ' + usuario.rut + (usuario.ruta ? ' · ' + routeLabel(usuario.ruta) : '')) + '</option>'; }).join('') +
        '</select></div></div>';
    }

    routesHost.innerHTML = html;
    document.getElementById('route-select').addEventListener('change', function (event) { draft.ruta = event.target.value; });
    routesHost.querySelectorAll('[data-local-day]').forEach(function (button) { button.addEventListener('click', function () { draft.days[button.dataset.day] = !draft.days[button.dataset.day]; renderEditor(); }); });
    routesHost.querySelectorAll('[data-client]').forEach(function (button) { button.addEventListener('click', function () { var id = Number(button.dataset.client); draft.clients[id] = !draft.clients[id]; renderEditor(); }); });
    routesHost.querySelectorAll('[data-rep-day]').forEach(function (button) { button.addEventListener('click', function () { var rep = draft.reps[Number(button.dataset.repDay)]; rep.days[button.dataset.day] = !rep.days[button.dataset.day]; renderEditor(); }); });
    routesHost.querySelectorAll('[data-rep-client]').forEach(function (button) {
      button.addEventListener('click', function () {
        var parts = button.dataset.repClient.split(':'), rep = draft.reps[Number(parts[0])], id = Number(parts[1]);
        rep.sel[id] = !rep.sel[id]; rep.modoTodos = false; renderEditor();
      });
    });
    routesHost.querySelectorAll('[data-rep-remove]').forEach(function (button) { button.addEventListener('click', function () { draft.reps[Number(button.dataset.repRemove)].removed = true; renderEditor(); }); });
    routesHost.querySelectorAll('[data-rep-undo]').forEach(function (button) { button.addEventListener('click', function () { draft.reps[Number(button.dataset.repUndo)].removed = false; renderEditor(); }); });
    routesHost.querySelectorAll('[data-new-day]').forEach(function (button) { button.addEventListener('click', function () { var rep = draft.newReps[Number(button.dataset.newDay)]; rep.days[button.dataset.day] = !rep.days[button.dataset.day]; renderEditor(); }); });
    routesHost.querySelectorAll('[data-new-client]').forEach(function (button) {
      button.addEventListener('click', function () {
        var parts = button.dataset.newClient.split(':'), rep = draft.newReps[Number(parts[0])], id = Number(parts[1]);
        rep.sel[id] = !rep.sel[id]; renderEditor();
      });
    });
    routesHost.querySelectorAll('[data-new-remove]').forEach(function (button) { button.addEventListener('click', function () { draft.newReps.splice(Number(button.dataset.newRemove), 1); renderEditor(); }); });
    var addSelect = document.getElementById('rep-add-select');
    if (addSelect) {
      addSelect.addEventListener('change', function () {
        var usuario = state.usuarios.find(function (u) { return u.rut === addSelect.value; });
        if (!usuario) return;
        draft.newReps.push({ rut: usuario.rut, nombre: usuario.nombre, days: {}, sel: {} });
        renderEditor();
      });
    }
  }
  function closeEdit() { editOverlay.classList.remove('open'); state.current = null; state.draft = null; }

  /* Marcas por reponedor: se materializan explícitamente. La reconciliación de
     maestra usa asignacion_visita_cliente como fuente, asi que lista vacia no
     debe interpretarse como "todas" al guardar desde este mantenedor. */
  function repClientPayload(rep, enabledIds) {
    var selected = enabledIds.filter(function (id) { return rep.sel[id]; });
    if (!selected.length || selected.length === enabledIds.length) return enabledIds;
    return selected;
  }
  function repClientsChanged(rep, enabledIds, original) {
    var payload = repClientPayload(rep, enabledIds);
    var originalTodos = !!(original && original.clientes && original.clientes.modo === 'todos');
    if (originalTodos) return payload.length > 0;
    var originalIds = original ? asigClientIds(original).sort(function (a, b) { return a - b; }) : [];
    if (!payload.length) return originalIds.length > 0 || !originalTodos;
    return payload.slice().sort(function (a, b) { return a - b; }).join(',') !== originalIds.join(',');
  }

  function saveEdit() {
    var row = state.current, draft = state.draft;
    if (!row || !draft) return;
    var oldIds = unionClientIds(row), newIds = state.clients.filter(function (client) { return draft.clients[client.id]; }).map(function (client) { return Number(client.id); });
    var added = newIds.filter(function (id) { return oldIds.indexOf(id) < 0; });
    var removed = oldIds.filter(function (id) { return newIds.indexOf(id) < 0; });
    var routeChanged = text(row.ruta) !== draft.ruta;
    var operations = [];
    var summary = { reps: 0 };
    var aplicarQueued = false;

    if (!state.asigByLocal) {
      // Flujo clásico (backend sin /web/admin/asignaciones): un reponedor por local.
      if (draft.ruta && !daysString(draft.days)) { toast('Marca al menos un día de visita', true); return; }
      var nextDays = daysString(draft.days);
      var currentDays = normalizedDaysString(row.dias_visita);
      var legacyChanged = routeChanged || currentDays !== nextDays || (nextDays && text(row.dias_visita) !== nextDays);
      if (legacyChanged) operations.push(function () { return API.requestJson('/web/admin/mantenedores/rutas/' + encodeURIComponent(row.id), { method: 'PATCH', body: JSON.stringify({ ruta: draft.ruta || null, dias_visita: draft.ruta ? nextDays : null }) }); });
    } else {
      if (routeChanged && !draft.reps.length) {
        operations.push(function () { return API.requestJson('/web/admin/mantenedores/rutas/' + encodeURIComponent(row.id), { method: 'PATCH', body: JSON.stringify({ ruta: draft.ruta || null, dias_visita: null }) }); });
      }
      var enabledIds = newIds;
      var covered = {};
      draft.reps.filter(function (rep) { return !rep.removed; }).concat(draft.newReps).forEach(function (rep) {
        repClientPayload(rep, enabledIds).forEach(function (id) { covered[id] = true; });
      });
      var sinReponedor = enabledIds.filter(function (id) { return !covered[id]; });
      if (sinReponedor.length) {
        toast('Cada marca habilitada debe quedar asociada al menos a un reponedor', true);
        return;
      }
      draft.reps.forEach(function (rep) {
        var original = asigsFor(row.id).find(function (asig) { return asig.id === rep.id; });
        if (rep.removed) {
          summary.reps++;
          operations.push(function () { return API.requestJson('/web/admin/asignaciones/' + rep.id, { method: 'PATCH', body: JSON.stringify({ activo: false }) }); });
          return;
        }
        var nextRepDays = daysString(rep.days);
        if (original && (routeChanged || nextRepDays !== normalizedDaysString(original.dias_visita))) {
          summary.reps++;
          operations.push(function () { return API.requestJson('/web/admin/asignaciones/' + rep.id, { method: 'PATCH', body: JSON.stringify({ ruta: draft.ruta || null, dias_visita: nextRepDays || null }) }); });
        }
      });
      draft.newReps.forEach(function (rep) {
        summary.reps++;
        operations.push(function () {
          return API.requestJson('/web/admin/asignaciones', { method: 'POST', body: JSON.stringify({ id_local: row.id, rut: rep.rut, ruta: draft.ruta || null, dias_visita: daysString(rep.days) || null, id_clientes: repClientPayload(rep, enabledIds) }) })
            .then(function (created) { rep.createdId = created.id; return created; });
        });
      });
      // En modo multi-reponedor la fuente de verdad son exclusivamente los
      // clientes materializados en cada asignacion.
      aplicarQueued = true;
      draft.reps.forEach(function (rep) {
        var original = asigsFor(row.id).find(function (asig) { return asig.id === rep.id; });
        if (rep.removed) return;
        if (repClientsChanged(rep, enabledIds, original)) {
          summary.reps++;
          operations.push(function () { return API.requestJson('/web/admin/asignaciones/' + rep.id + '/clientes', { method: 'PUT', body: JSON.stringify({ id_clientes: repClientPayload(rep, enabledIds) }) }); });
        }
      });
    }

    // Habilitación de marcas a nivel local (cliente_local). En modo multi las
    // altas ya se encolaron antes de los reponedores; las bajas van al final.
    if (!aplicarQueued) added.forEach(function (id) { operations.push(function () { return API.requestJson('/web/admin/mantenedores/rutas/' + encodeURIComponent(row.id) + '/clientes/aplicar', { method: 'POST', body: JSON.stringify({ id_cliente: id }) }); }); });
    if (!state.asigByLocal) removed.forEach(function (id) { operations.push(function () { return API.requestJson('/web/admin/mantenedores/rutas/' + encodeURIComponent(row.id) + '/clientes/quitar', { method: 'POST', body: JSON.stringify({ id_cliente: id }) }); }); });

    if (!operations.length) { closeEdit(); toast('No había diferencias para guardar'); return; }
    var button = document.getElementById('m-save'); button.disabled = true;
    operations.reduce(function (chain, operation) { return chain.then(operation); }, Promise.resolve()).then(function () {
      state.history.unshift({ ts: Date.now(), local: row.id, rutaAntes: row.ruta || '—', rutaDespues: draft.ruta || '—', added: added.length, removed: removed.length, reps: summary.reps });
      closeEdit(); return load();
    }).then(function () { toast('Cambios guardados en el backend'); }).catch(function (error) { toast(errorMessage(error), true); }).finally(function () { button.disabled = false; });
  }

  function clearRoute() {
    if (!state.current || !confirm('¿Quitar la ruta y todos los clientes asociados de este local?')) return;
    state.draft.ruta = ''; state.draft.days = {}; state.clients.forEach(function (client) { state.draft.clients[client.id] = false; });
    if (state.asigByLocal) state.draft.reps.forEach(function (rep) { rep.removed = true; });
    if (state.draft.newReps) state.draft.newReps = [];
    saveEdit();
  }
  function showHistory() {
    var host = document.getElementById('h-body');
    host.innerHTML = '<p class="log-empty">Cargando historial...</p>';
    document.getElementById('histOverlay').classList.add('open');
    API.requestJson('/web/admin/mantenedores/rutas/historial?limit=200').then(function (payload) {
      var items = payload.cambios || [];
      host.innerHTML = items.length ? items.map(renderHistoryItem).join('') : '<p class="log-empty">No hay cambios guardados en el historial permanente.</p>';
      var count = document.getElementById('histCount');
      if (count) { count.textContent = String(items.length); count.style.display = items.length ? '' : 'none'; }
    }).catch(function (error) {
      host.innerHTML = '<p class="log-empty">No fue posible cargar el historial: ' + esc(errorMessage(error)) + '</p>';
    });
  }

  function renderHistoryItem(item) {
    var cambios = Array.isArray(item.cambios) ? item.cambios : [];
    var lines = cambios.map(function (change) {
      return '<div><b>' + esc(change.campo || 'Cambio') + ':</b> ' + esc(change.antes || '—') + ' → ' + esc(change.despues || '—') + '</div>';
    }).join('');
    return '<div class="log-entry"><b>' + esc(item.registro_id) + '</b> · ' + esc(new Date(item.creado_en).toLocaleString('es-CL')) +
      (item.usuario_email ? ' · ' + esc(item.usuario_email) : '') +
      (lines ? '<br>' + lines : '') + '</div>';
  }

  var pickedLocal = null;
  function openAddLocal() {
    var available = state.rows.filter(function (row) { return clientIds(row).length === 0; });
    var overlay = document.getElementById('addOverlay');
    document.getElementById('a-step1').style.display = '';
    document.getElementById('a-step2').style.display = 'none';
    document.getElementById('a-step-badge').textContent = 'Seleccionar local';
    document.getElementById('a-title').textContent = 'Agregar local';
    document.getElementById('a-sub').textContent = 'Busca y selecciona el local que quieres incorporar a la base de rutas.';
    var filterHost = document.getElementById('a-filters');
    filterHost.innerHTML = '<input class="dd-search" id="a-local-search" type="search" placeholder="Buscar código local llave, código local o nombre…" style="width:min(460px,100%);margin:0">';
    document.getElementById('a-back').style.display = 'none';
    document.getElementById('a-save').style.display = 'none';
    var next = document.getElementById('a-next'); next.style.display = ''; next.textContent = 'Continuar'; next.disabled = true;
    pickedLocal = null;
    function renderAvailable(query) {
      query = text(query).trim().toLowerCase();
      var shown = available.filter(function (row) {
        return !query || [row.id, row.codigo_local, row.nombre, row.cadena, row.formato].some(function (value) { return text(value).toLowerCase().indexOf(query) >= 0; });
      });
      document.getElementById('a-tbody').innerHTML = shown.map(function (row) {
        return '<tr data-add-local="' + esc(row.id) + '"><td><span class="pradio"></span></td><td class="pcode">' + esc(row.id) + '</td><td>' + esc(row.codigo_local || row.id) + '</td><td>' + esc(title(row.cadena)) + '</td><td><span class="pfmt-badge">' + esc(row.formato || '—') + '</span></td><td>' + esc(title(row.nombre)) + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="pempty">No hay locales que coincidan con la búsqueda.</td></tr>';
      document.getElementById('a-count').textContent = 'Mostrando ' + shown.length + ' de ' + available.length + ' locales disponibles';
    }
    renderAvailable('');
    document.getElementById('a-local-search').addEventListener('input', function () { pickedLocal = null; next.disabled = true; renderAvailable(this.value); });
    overlay.classList.add('open');
    setTimeout(function () { document.getElementById('a-local-search').focus(); }, 0);
  }
  function closeAddLocal() { document.getElementById('addOverlay').classList.remove('open'); }

  function addBrandButton() {
    var host = document.querySelector('.toolbar-actions');
    var button = document.createElement('button'); button.className = 'btn btn-add'; button.type = 'button'; button.textContent = '+ Agregar marca'; host.appendChild(button);
    var overlay = document.createElement('div'); overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><button class="modal-close" type="button">✕</button><span class="cadena-badge">Maestra Local–Producto</span><h2>Agregar marca al local</h2><p class="modal-sub">Selecciona el local y cliente que deseas habilitar.</p></div><div class="modal-body"><div class="edit-grid"><div class="edit-field"><label>Local</label><select class="edit-input edit-select" data-brand-local><option value="">Selecciona…</option>' + state.rows.map(function (row) { return '<option value="' + esc(row.id) + '">' + esc(row.id + ' · ' + title(row.nombre)) + '</option>'; }).join('') + '</select></div><div class="edit-field"><label>Cliente</label><select class="edit-input edit-select" data-brand-client><option value="">Selecciona…</option>' + state.clients.map(function (client) { return '<option value="' + client.id + '">' + esc(client.nombre) + '</option>'; }).join('') + '</select></div></div><div data-brand-result></div></div><div class="modal-foot"><button class="btn btn-ghost" data-brand-cancel>Cancelar</button><button class="btn btn-save" data-brand-save>Agregar marca</button></div></div>';
    document.body.appendChild(overlay);
    function close() { overlay.classList.remove('open'); }
    button.addEventListener('click', function () { overlay.classList.add('open'); });
    overlay.querySelector('.modal-close').addEventListener('click', close); overlay.querySelector('[data-brand-cancel]').addEventListener('click', close);
    overlay.querySelector('[data-brand-save]').addEventListener('click', function () {
      var local = overlay.querySelector('[data-brand-local]').value, client = Number(overlay.querySelector('[data-brand-client]').value), save = this;
      if (!local || !client) { toast('Selecciona local y cliente', true); return; }
      save.disabled = true;
      API.requestJson('/web/admin/mantenedores/rutas/' + encodeURIComponent(local) + '/clientes/aplicar', { method: 'POST', body: JSON.stringify({ id_cliente: client }) })
        .then(function () { close(); return load(); }).then(function () { toast('Marca agregada correctamente'); })
        .catch(function (error) { toast(errorMessage(error), true); }).finally(function () { save.disabled = false; });
    });
  }

  tbody.addEventListener('click', function (event) { var cell = event.target.closest('[data-local]'); if (cell) openEdit(cell.dataset.local); });
  document.getElementById('m-close').addEventListener('click', closeEdit);
  document.getElementById('m-cancel').addEventListener('click', closeEdit);
  document.getElementById('m-save').addEventListener('click', saveEdit);
  document.getElementById('m-delete').addEventListener('click', clearRoute);
  document.getElementById('historyBtn').addEventListener('click', showHistory);
  ['h-close', 'h-done'].forEach(function (id) { document.getElementById(id).addEventListener('click', function () { document.getElementById('histOverlay').classList.remove('open'); }); });
  document.getElementById('h-export').style.display = 'none';
  document.getElementById('addLocalBtn').addEventListener('click', openAddLocal);
  document.getElementById('a-close').addEventListener('click', closeAddLocal);
  document.getElementById('a-cancel').addEventListener('click', closeAddLocal);
  document.getElementById('a-tbody').addEventListener('click', function (event) {
    var row = event.target.closest('[data-add-local]'); if (!row) return;
    if (pickedLocal === row.dataset.addLocal) {
      pickedLocal = null;
      row.classList.remove('sel');
      document.getElementById('a-next').disabled = true;
      return;
    }
    pickedLocal = row.dataset.addLocal;
    this.querySelectorAll('tr').forEach(function (item) { item.classList.toggle('sel', item === row); });
    document.getElementById('a-next').disabled = false;
  });
  document.getElementById('a-next').addEventListener('click', function () { if (pickedLocal) { closeAddLocal(); openEdit(pickedLocal); } });
  document.addEventListener('click', function () { document.querySelectorAll('.filter-wrap.open').forEach(function (node) { node.classList.remove('open'); }); });
  editOverlay.addEventListener('click', function (event) { if (event.target === editOverlay) closeEdit(); });
  load().then(addBrandButton);
})();
