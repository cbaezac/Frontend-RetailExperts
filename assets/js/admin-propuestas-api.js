(function () {
  var API = window.RetailAPI;
  var C = window.MANT_CONFIG;
  if (!API || !C) return;
  var types = { locales: 'local', productos: 'producto', localproducto: 'local_producto' };
  var tipo = types[C.key];
  if (!tipo) return;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function load() {
    return API.requestJson('/web/admin/mantenedores/propuestas?tipo=' + tipo + '&estado=pendiente').then(function (r) { return r.propuestas || []; });
  }
  function resolve(id, accion) {
    return API.requestJson('/web/admin/mantenedores/propuestas/' + id, { method:'PATCH', body:JSON.stringify({accion:accion}) });
  }
  function install(rows) {
    var actions = document.querySelector('.toolbar-actions');
    if (!actions) return;
    var btn = document.createElement('button'); btn.type='button'; btn.className='btn btn-ghost';
    btn.innerHTML='◇ Pendientes <strong>' + rows.length + '</strong>'; actions.insertBefore(btn, actions.firstChild);
    var overlay=document.createElement('div'); overlay.style.cssText='display:none;position:fixed;inset:0;background:#0008;z-index:9999;padding:5vh 4vw;overflow:auto';
    overlay.innerHTML='<div style="max-width:900px;margin:auto;background:#fffdf6;border-radius:20px;padding:24px"><div style="display:flex;justify-content:space-between"><h2>Propuestas pendientes</h2><button data-close type="button">Cerrar</button></div><div data-list></div></div>';
    document.body.appendChild(overlay);
    function yesNo(value) { return value ? 'Sí' : 'No'; }
    function render(list){
      btn.querySelector('strong').textContent=list.length;
      overlay.querySelector('[data-list]').innerHTML=list.length?list.map(function(p){
        var x=p.payload||{};
        if(p.tipo==='local_producto' && x.id_local && x.id_producto){
          return '<article style="border-top:1px solid #ddd;padding:16px 0">'
            +'<b>'+esc(x.id_local)+(x.nombre_local?' · '+esc(x.nombre_local):'')+'</b>'
            +'<p style="margin:8px 0"><strong>Cliente:</strong> '+esc(x.cliente||x.id_cliente)
            +' &nbsp; <strong>Producto:</strong> '+esc(x.codigo_producto||x.id_producto)
            +(x.producto?' · '+esc(x.producto):'')+'</p>'
            +'<p style="margin:8px 0">'+esc(p.motivo||'La regla automática difiere de la decisión manual.')+'</p>'
            +'<p style="margin:8px 0"><strong>Estado manual actual:</strong> '+yesNo(!!x.valor_actual)
            +' &nbsp;→&nbsp; <strong>Recomendación automática:</strong> '+yesNo(!!x.lo_gestionamos)+'</p>'
            +'<small>Regla: '+esc(x.regla||'cobertura local-producto')+'</small><br><br>'
            +'<button data-approve="'+p.id+'">Aplicar recomendación y volver a automático</button> '
            +'<button data-reject="'+p.id+'">Mantener decisión manual</button></article>';
        }
        return '<article style="border-top:1px solid #ddd;padding:14px 0"><b>#'+p.id+' · '+esc(p.motivo||p.tipo)+'</b><pre style="white-space:pre-wrap">'+esc(JSON.stringify(x,null,2))+'</pre><button data-approve="'+p.id+'">Aprobar</button> <button data-reject="'+p.id+'">Rechazar</button></article>';
      }).join(''):'<p>No hay propuestas pendientes.</p>';
    }
    btn.onclick=function(){load().then(function(x){render(x);overlay.style.display='block';});};
    overlay.onclick=function(e){if(e.target.hasAttribute('data-close'))overlay.style.display='none';var id=e.target.getAttribute('data-approve')||e.target.getAttribute('data-reject');if(id){resolve(id,e.target.hasAttribute('data-approve')?'aprobar':'rechazar').then(function(){window.location.reload();});}};
  }
  load().then(install).catch(function(){});
})();
