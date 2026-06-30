(function(){
  var API=window.RetailAPI; if(!API)return;
  var host=document.querySelector('.toolbar-actions'); if(!host)return;
  var btn=document.createElement('button'); btn.className='btn btn-add'; btn.type='button'; btn.textContent='+ Agregar marca'; host.appendChild(btn);
  var overlay=document.createElement('div'); overlay.style.cssText='display:none;position:fixed;inset:0;background:#0008;z-index:9999;padding:8vh 20px';
  overlay.innerHTML='<div style="max-width:560px;margin:auto;background:#fffdf6;border-radius:20px;padding:26px"><h2>Agregar marca al local</h2><p>El backend calculará los productos según ventas de 28 días o la regla Procarne.</p><label>Código local<input id="rc-local" style="display:block;width:100%;margin:6px 0 14px;padding:10px"></label><label>Cliente<select id="rc-cliente" style="display:block;width:100%;margin:6px 0 14px;padding:10px"></select></label><div id="rc-preview"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button id="rc-close">Cancelar</button><button id="rc-next">Vista previa</button><button id="rc-apply" style="display:none">Confirmar y aplicar</button></div></div>';
  document.body.appendChild(overlay);
  var local=overlay.querySelector('#rc-local'), client=overlay.querySelector('#rc-cliente'), preview=overlay.querySelector('#rc-preview'), apply=overlay.querySelector('#rc-apply');
  var optionsPromise=API.requestJson('/web/admin/mantenedores/opciones').then(function(o){
    client.innerHTML='<option value="">Selecciona…</option>'+(o.clientes||[]).map(function(c){return '<option value="'+c.id+'">'+c.nombre+'</option>';}).join('');
    return o.clientes||[];
  });
  function normalized(value){return String(value||'').trim().toLowerCase();}
  window.sincronizarClientesDesdeRutas=function(codigoLocal,nombresActivos,nombresQuitados){
    return optionsPromise.then(function(clientes){
      function idsFor(nombres){return (nombres||[]).map(function(nombre){
        var wanted=normalized(nombre);
        var found=clientes.find(function(c){return normalized(c.nombre)===wanted;});
        if(!found)throw new Error('No se encontró el cliente '+nombre+' en el backend');
        return Number(found.id);
      });}
      var operaciones=idsFor(nombresActivos).map(function(id){return {id:id,accion:'aplicar'};})
        .concat(idsFor(nombresQuitados).map(function(id){return {id:id,accion:'quitar'};}));
      return operaciones.reduce(function(chain,operacion){
        return chain.then(function(resultados){
          return API.requestJson('/web/admin/mantenedores/rutas/'+encodeURIComponent(codigoLocal)+'/clientes/'+operacion.accion,{
            method:'POST',body:JSON.stringify({id_cliente:operacion.id})
          }).then(function(resultado){resultados.push(resultado);return resultados;});
        });
      },Promise.resolve([]));
    });
  };
  window.aplicarClientesDesdeRutas=function(codigoLocal,nombres){return window.sincronizarClientesDesdeRutas(codigoLocal,nombres,[]);};
  btn.onclick=function(){overlay.style.display='block';preview.innerHTML='';apply.style.display='none';};
  overlay.querySelector('#rc-close').onclick=function(){overlay.style.display='none';};
  overlay.querySelector('#rc-next').onclick=function(){if(!local.value||!client.value)return;API.requestJson('/web/admin/mantenedores/rutas/'+encodeURIComponent(local.value)+'/clientes/preview',{method:'POST',body:JSON.stringify({id_cliente:Number(client.value)})}).then(function(r){preview.innerHTML='<p><b>Regla:</b> '+r.regla+'</p><p><b>'+r.total+'</b> productos: '+r.crear+' nuevos, '+r.reactivar+' reactivados y '+r.existentes+' existentes.</p>';apply.style.display='inline-block';}).catch(function(e){preview.textContent=e.message;});};
  apply.onclick=function(){apply.disabled=true;API.requestJson('/web/admin/mantenedores/rutas/'+encodeURIComponent(local.value)+'/clientes/aplicar',{method:'POST',body:JSON.stringify({id_cliente:Number(client.value)})}).then(function(r){preview.innerHTML='<b>'+r.aplicadas+' combinaciones aplicadas.</b>';apply.style.display='none';}).catch(function(e){preview.textContent=e.message;}).finally(function(){apply.disabled=false;});};
})();
