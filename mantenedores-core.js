/* Motor genérico de Mantenedores · Retail Experts
   Cada página define window.MANT_CONFIG y luego carga este archivo.
   config = {
     key, title, eyebrow, sub, idField,
     columns: [{key,label,kind?,cls?,fmt?}],  kind: 'id'|'estado'|'pill'|'pillp'|'text'
     filters: [{key,label}],
     fields:  [{key,label,type:'text'|'select'|'readonly', options?, required?, hint?}],
     estadoField, estadoOn, estadoOff,
     data: [...], storeKey, logKey, searchKeys:[...]
   }
*/
(function(){
  var C = window.MANT_CONFIG;
  if(!C) return;
  var data=[], changeLog=[];
  var STORE=C.storeKey, LOG=C.logKey;

  (function init(){
    var saved=null; try{ saved=JSON.parse(localStorage.getItem(STORE)||'null'); }catch(e){}
    data = (saved && saved.length) ? saved : C.data.map(function(r){ return Object.assign({}, r); });
    try{ changeLog=JSON.parse(localStorage.getItem(LOG)||'[]'); }catch(e){ changeLog=[]; }
  })();
  function persist(){ try{ localStorage.setItem(STORE, JSON.stringify(data)); }catch(e){} }
  function persistLog(){ try{ localStorage.setItem(LOG, JSON.stringify(changeLog)); }catch(e){} }

  var sel={ q:'', filters:{} };
  C.filters.forEach(function(f){ sel.filters[f.key]=[]; });

  function uniq(key){ var s={}; data.forEach(function(r){ if(r[key]!=null && r[key]!=='') s[r[key]]=true; }); return Object.keys(s).sort(function(a,b){return String(a).localeCompare(String(b),'es',{numeric:true});}); }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ---- Header / titles ---- */
  document.getElementById('head-title').textContent = C.title;
  document.getElementById('page-title').textContent = C.title;
  document.getElementById('eyebrow').textContent = C.eyebrow || 'Base maestra';
  document.getElementById('page-sub').textContent = C.sub || '';
  document.getElementById('crumb-here').textContent = C.title;
  document.title = 'Mantenedor ' + C.title + ' · Retail Experts';

  /* ---- Toolbar: search + filters ---- */
  document.getElementById('search').placeholder = 'Buscar…';
  document.getElementById('search').addEventListener('input', function(){ sel.q=this.value.trim().toLowerCase(); render(); });

  var filtersHost=document.getElementById('filters');
  C.filters.forEach(function(f){
    var wrap=document.createElement('div'); wrap.className='filter-wrap';
    var btn=document.createElement('button'); btn.className='filter'; btn.type='button'; btn.setAttribute('aria-expanded','false');
    btn.innerHTML='<span>'+f.label+'</span><span class="chev"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    var dd=document.createElement('div'); dd.className='dropdown';
    var opts=uniq(f.key);
    var searchable=opts.length>8;
    dd.innerHTML=(searchable?'<input class="dd-search" type="text" placeholder="Buscar '+f.label.toLowerCase()+'…" />':'')+'<div class="dd-list"></div>';
    var list=dd.querySelector('.dd-list');
    opts.forEach(function(o){ var it=document.createElement('label'); it.className='dd-item'; it.innerHTML='<input type="checkbox" value="'+esc(o)+'" /><span>'+esc(o)+'</span>'; list.appendChild(it); });
    wrap.appendChild(btn); wrap.appendChild(dd); filtersHost.appendChild(wrap);
    btn.addEventListener('click', function(e){ e.stopPropagation(); var open=wrap.classList.contains('open'); closeAll(); if(!open){ wrap.classList.add('open'); btn.setAttribute('aria-expanded','true'); var s=dd.querySelector('.dd-search'); if(s)s.focus(); } });
    dd.addEventListener('click', function(e){ e.stopPropagation(); });
    var sb=dd.querySelector('.dd-search');
    if(sb){ sb.addEventListener('input', function(){ var q=sb.value.toLowerCase().trim(); var any=false; list.querySelectorAll('.dd-item').forEach(function(it){ var m=it.textContent.toLowerCase().indexOf(q)!==-1; it.style.display=m?'flex':'none'; if(m)any=true; }); var e=dd.querySelector('.dd-empty'); if(!any&&!e){ e=document.createElement('div'); e.className='dd-empty'; e.textContent='Sin resultados'; list.appendChild(e);} else if(any&&e){e.remove();} }); }
    dd.addEventListener('change', function(){ sel.filters[f.key]=[].slice.call(dd.querySelectorAll('input:checked')).map(function(c){return c.value;}); var n=sel.filters[f.key].length; if(n){ btn.classList.add('has-selection'); var c=btn.querySelector('.count'); if(!c){c=document.createElement('span'); c.className='count'; btn.appendChild(c);} c.textContent=n; } else { btn.classList.remove('has-selection'); var c2=btn.querySelector('.count'); if(c2)c2.remove(); } render(); });
  });
  function closeAll(){ document.querySelectorAll('.filter-wrap.open').forEach(function(w){ w.classList.remove('open'); var b=w.querySelector('.filter'); if(b)b.setAttribute('aria-expanded','false'); }); }
  document.addEventListener('click', closeAll);

  /* ---- Table ---- */
  var thead=document.getElementById('thead'), tbody=document.getElementById('tbody');
  if(C.fitTable){ var tbl=thead.closest('table'); if(tbl){ tbl.classList.add('fit'); if(C.fitXs) tbl.classList.add('fit-xs'); } }
  thead.innerHTML='<tr>'+C.columns.map(function(col){ return '<th>'+esc(col.label)+'</th>'; }).join('')+'<th class="center">Acciones</th></tr>';

  function cellHtml(col,r){
    var v=r[col.key];
    if(col.kind==='id') return '<td class="id-code">'+esc(v)+'</td>';
    if(col.kind==='estado'){ var on=(v===C.estadoOn); return '<td><span class="estado-badge '+(on?'e-on':'e-off')+(C.estadoNoDot?' no-dot':'')+'">'+(C.estadoNoDot?'':'<span class="dot"></span>')+esc(v)+'</span></td>'; }
    if(col.kind==='pill') return '<td><span class="pill">'+esc(v)+'</span></td>';
    if(col.kind==='pillp') return '<td><span class="pill pill-p">'+esc(v)+'</span></td>';
    if(col.kind==='muted') return '<td class="muted-cell">'+esc(v)+'</td>';
    return '<td>'+esc(v)+'</td>';
  }
  function matchRow(r){
    for(var k in sel.filters){ if(sel.filters[k].length && sel.filters[k].indexOf(String(r[k]))===-1) return false; }
    if(sel.q){ var hay=(C.searchKeys||C.columns.map(function(c){return c.key;})).map(function(k){return r[k];}).join(' ').toLowerCase(); if(hay.indexOf(sel.q)===-1) return false; }
    return true;
  }
  function render(){
    var list=data.filter(matchRow);
    if(list.length===0){ tbody.innerHTML='<tr class="empty-row"><td colspan="'+(C.columns.length+1)+'">No hay registros que coincidan.</td></tr>'; }
    else {
      tbody.innerHTML=list.map(function(r){
        return '<tr>'+C.columns.map(function(col){return cellHtml(col,r);}).join('')
          +'<td><div class="row-actions">'
          +'<button class="icon-btn icon-edit" type="button" data-edit="'+esc(r[C.idField])+'" title="Editar"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L4 16v4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 7.5 3 3" stroke="currentColor" stroke-width="1.8"/></svg></button>'
          +'<button class="icon-btn icon-del" type="button" data-del="'+esc(r[C.idField])+'" title="Eliminar"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12a2 2 0 0 1-2 1.9H7.7a2 2 0 0 1-2-1.9L5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
          +'</div></td></tr>';
      }).join('');
    }
    document.getElementById('resultCount').innerHTML='<b>'+list.length+'</b> de '+data.length+' registros';
  }

  /* ---- Modal ---- */
  var overlay=document.getElementById('editOverlay');
  var fieldsHost=document.getElementById('modal-fields');
  // build modal fields
  var fieldEls={};
  (function buildFields(){
    var rows=[]; var pair=[];
    C.fields.forEach(function(f){ pair.push(f); });
    // layout: readonly id full width; then pairs
    var html='';
    C.fields.forEach(function(f){
      var inner;
      if(f.type==='select'){ inner='<select id="mf-'+f.key+'"><option value="" disabled>Selecciona…</option>'+(f.options||uniq(f.key)).map(function(o){return '<option value="'+esc(o)+'">'+esc(o)+'</option>';}).join('')+'</select>'; }
      else { inner='<input type="text" id="mf-'+f.key+'"'+(f.type==='readonly'?' readonly':'')+' placeholder="'+esc(f.placeholder||'')+'" />'; }
      html+='<div class="field"'+(f.full?'':'')+'><label for="mf-'+f.key+'">'+esc(f.label)+(f.required?' <span class="req">*</span>':'')+'</label>'+inner+(f.hint?'<p class="field-hint">'+esc(f.hint)+'</p>':'')+'</div>';
    });
    fieldsHost.innerHTML=html;
    C.fields.forEach(function(f){ fieldEls[f.key]=document.getElementById('mf-'+f.key); });
  })();

  var curId=null;
  function nextId(){
    if(typeof C.nextId==='function') return C.nextId(data);
    return '';
  }
  function openEdit(id){
    curId=id; var r=data.filter(function(x){return String(x[C.idField])===String(id);})[0]; if(!r) return;
    document.getElementById('modal-title').textContent='Editar registro';
    document.getElementById('modal-sub').textContent='Modifica los datos del registro.';
    var addEditable=C.addEditable||[];
    C.fields.forEach(function(f){ fieldEls[f.key].value=(r[f.key]!=null?r[f.key]:''); if(addEditable.indexOf(f.key)>=0 || f.type==='readonly') setFieldReadonly(f,true); else setFieldReadonly(f,false); });
    document.getElementById('e-delete').style.display='';
    overlay.classList.add('open');
  }
  function setFieldReadonly(f, ro){ var el=fieldEls[f.key]; if(!el) return; if(el.tagName==='INPUT'){ el.readOnly=ro; } el.disabled = (ro && el.tagName==='SELECT'); }
  function openAdd(){
    curId=null;
    document.getElementById('modal-title').textContent='Agregar registro';
    document.getElementById('modal-sub').textContent='Completa los datos del nuevo registro.';
    var addEditable=C.addEditable||[];
    C.fields.forEach(function(f){
      var el=fieldEls[f.key];
      if(addEditable.indexOf(f.key)>=0){ setFieldReadonly(f,false); el.value=f.default||''; }
      else if(f.type==='readonly'){ setFieldReadonly(f,true); el.value=nextId(); }
      else { setFieldReadonly(f,false); el.value=f.default||''; }
    });
    document.getElementById('e-delete').style.display='none';
    overlay.classList.add('open');
  }
  function closeEdit(){ overlay.classList.remove('open'); curId=null; }

  function save(){
    var vals={};
    for(var i=0;i<C.fields.length;i++){ var f=C.fields[i]; var v=(fieldEls[f.key].value||'').trim(); if(f.required && !v){ toast('Completa: '+f.label); return; } vals[f.key]=v; }
    if(curId){
      var r=data.filter(function(x){return String(x[C.idField])===String(curId);})[0];
      var changes=[];
      C.fields.forEach(function(f){ if(String(r[f.key]||'')!==String(vals[f.key]||'')) changes.push({f:f.label,b:r[f.key]||'—',a:vals[f.key]||'—'}); });
      if(!changes.length){ toast('No hubo cambios'); closeEdit(); return; }
      C.fields.forEach(function(f){ r[f.key]=vals[f.key]; });
      if(typeof C.deriveRow==='function') C.deriveRow(r);
      logEntry('edit', r[C.idField], changes);
    } else {
      var nr={}; C.fields.forEach(function(f){ nr[f.key]=vals[f.key]; });
      if(typeof C.deriveRow==='function') C.deriveRow(nr);
      // ensure non-field columns copied (estado defaults etc.)
      data.unshift(nr);
      logEntry('add', nr[C.idField], C.fields.map(function(f){ return {f:f.label,b:'—',a:vals[f.key]||'—'}; }));
    }
    persist(); render(); closeEdit(); toast('Registro guardado');
  }
  function delCur(){
    if(!curId) return; var r=data.filter(function(x){return String(x[C.idField])===String(curId);})[0]; if(!r) return;
    if(!confirm('¿Eliminar el registro '+r[C.idField]+'?')) return;
    logEntry('del', r[C.idField], C.fields.map(function(f){ return {f:f.label,b:r[f.key]||'—',a:'—'}; }));
    data=data.filter(function(x){return String(x[C.idField])!==String(curId);});
    persist(); render(); closeEdit(); toast('Registro eliminado');
  }

  function logEntry(action,id,changes){ changeLog.unshift({ts:Date.now(),action:action,id:id,changes:changes}); persistLog(); updateHistBtn(); }

  tbody.addEventListener('click', function(e){
    var ed=e.target.closest('[data-edit]'); if(ed){ openEdit(ed.getAttribute('data-edit')); return; }
    var dl=e.target.closest('[data-del]'); if(dl){ curId=dl.getAttribute('data-del'); delCur(); return; }
  });
  document.getElementById('add').addEventListener('click', openAdd);
  document.getElementById('e-close').addEventListener('click', closeEdit);
  document.getElementById('e-cancel').addEventListener('click', closeEdit);
  document.getElementById('e-save').addEventListener('click', save);
  document.getElementById('e-delete').addEventListener('click', delCur);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) closeEdit(); });

  // bulk (placeholder)
  var bulk=document.getElementById('bulk'); if(bulk) bulk.addEventListener('click', function(){ toast('Carga masiva: se conectará al backend'); });

  /* ---- Historial ---- */
  var histOverlay=document.getElementById('histOverlay'), histCount=document.getElementById('histCount'), hBody=document.getElementById('h-body');
  function updateHistBtn(){ if(changeLog.length){ histCount.style.display='inline-block'; histCount.textContent=changeLog.length; } else histCount.style.display='none'; }
  function fmtTime(ts){ try{ return new Date(ts).toLocaleString('es-CL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){ return new Date(ts).toLocaleString(); } }
  var ACT={add:'Alta',edit:'Edición',del:'Baja'};
  function renderHistory(){
    if(!changeLog.length){ hBody.innerHTML='<p class="log-empty">Aún no se han registrado cambios.</p>'; return; }
    hBody.innerHTML='<div class="log-list">'+changeLog.map(function(e){
      return '<div class="log-entry"><div class="log-top"><span class="l-id">'+esc(e.id)+'</span><span class="l-act '+e.action+'">'+ACT[e.action]+'</span><span class="l-time">'+fmtTime(e.ts)+'</span></div>'
        + e.changes.map(function(c){ return '<div class="diff-row"><span class="diff-field">'+esc(c.f)+'</span><span class="diff-before">'+esc(c.b)+'</span><span class="diff-arrow">→</span><span class="diff-after">'+esc(c.a)+'</span></div>'; }).join('')
        + '</div>';
    }).join('')+'</div>';
  }
  document.getElementById('hist').addEventListener('click', function(){ renderHistory(); histOverlay.classList.add('open'); });
  document.getElementById('h-close').addEventListener('click', function(){ histOverlay.classList.remove('open'); });
  document.getElementById('h-done').addEventListener('click', function(){ histOverlay.classList.remove('open'); });
  histOverlay.addEventListener('click', function(e){ if(e.target===histOverlay) histOverlay.classList.remove('open'); });
  document.getElementById('h-export').addEventListener('click', function(){
    if(!changeLog.length){ toast('No hay cambios para exportar'); return; }
    var headers=['Fecha y hora','Acción','ID','Campo','Antes','Después','Usuario'];
    var xml='<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml+='<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#15130E" ss:Pattern="Solid"/></Style><Style ss:ID="c"/></Styles><Worksheet ss:Name="Cambios"><Table>';
    xml+='<Row ss:Height="22">'+headers.map(function(h){return '<Cell ss:StyleID="hdr"><Data ss:Type="String">'+esc(h)+'</Data></Cell>';}).join('')+'</Row>';
    changeLog.forEach(function(e){ var t=fmtTime(e.ts); e.changes.forEach(function(c){ [t,ACT[e.action],e.id,c.f,c.b,c.a,'Administrador'].forEach(function(){}); var vals=[t,ACT[e.action],e.id,c.f,c.b,c.a,'Administrador']; xml+='<Row>'+vals.map(function(v){return '<Cell ss:StyleID="c"><Data ss:Type="String">'+esc(v)+'</Data></Cell>';}).join('')+'</Row>'; }); });
    xml+='</Table></Worksheet></Workbook>';
    var blob=new Blob([xml],{type:'application/vnd.ms-excel'}); var url=URL.createObjectURL(blob);
    var dt=new Date(); var stamp=dt.getFullYear()+('0'+(dt.getMonth()+1)).slice(-2)+('0'+dt.getDate()).slice(-2);
    var a=document.createElement('a'); a.href=url; a.download='cambios-'+C.key+'-'+stamp+'.xls'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function(){URL.revokeObjectURL(url);},1000);
    toast('Historial exportado');
  });

  document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeEdit(); histOverlay.classList.remove('open'); } });

  function toast(msg){ var el=document.getElementById('toast'); el.innerHTML='<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>'+esc(msg)+'</span>'; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(function(){ el.classList.remove('show'); },2600); }
  window._mantToast=toast;

  if(window.logEvent){ try{ logEvent('Mantenedores', C.title); }catch(e){} }
  updateHistBtn();
  render();
})();
