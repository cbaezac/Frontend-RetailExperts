/* Paginador compartido Retail Experts.
   Mismo diseño que la paginación de Asistencia (cliente):
   "Página X de Y" a la izquierda, controles ‹ 1 2 … N › a la derecha,
   página activa en morado.

   Uso:
     var pager = createREPager('#miPager', { pageSize: 50, onChange: render, scrollTo: '.table-card' });
     function render(){
       var visibles = pager.slice(filas);   // pinta el pager y devuelve la página actual
       tbody.innerHTML = visibles.map(...).join('');
     }
     // al cambiar filtros: pager.reset(); render();
*/
(function () {
  var CSS_ID = 're-pager-css';
  var CSS = ''
    + '.re-pager{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:16px 6px 2px;}'
    + '.re-pager:empty{display:none;}'
    + '.re-pg-info{font-size:.88rem;color:var(--muted,#6E6275);font-family:var(--font-body,"Manrope",sans-serif);}'
    + '.re-pg-controls{display:flex;align-items:center;gap:6px;}'
    + '.re-pg-btn{min-width:38px;height:38px;padding:0 11px;display:inline-grid;place-items:center;border-radius:10px;border:1.5px solid var(--line,rgba(255,90,31,0.25));background:var(--card,#fff);color:var(--ink,#241026);font-family:var(--font-display,"Bricolage Grotesque",sans-serif);font-weight:600;font-size:.9rem;cursor:pointer;transition:all .15s;}'
    + '.re-pg-btn:hover:not(:disabled){border-color:var(--ink,#241026);}'
    + '.re-pg-btn.on{background:var(--purple,#5A0D74);color:#fff;border-color:var(--purple,#5A0D74);}'
    + '.re-pg-btn:disabled{opacity:.4;cursor:not-allowed;}'
    + '.re-pg-ellipsis{color:var(--muted,#6E6275);padding:0 4px;}';

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  window.createREPager = function (container, opts) {
    opts = opts || {};
    injectCss();
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) throw new Error('createREPager: contenedor no encontrado');
    container.classList.add('re-pager');
    var page = 0, total = 0, ps = opts.pageSize || 50;

    function totalPages() { return Math.max(1, Math.ceil(total / ps)); }

    function render() {
      var tp = totalPages();
      if (total === 0 || tp <= 1) { container.innerHTML = ''; return; }
      var html = '<span class="re-pg-info">Página ' + (page + 1) + ' de ' + tp + '</span>';
      html += '<div class="re-pg-controls">';
      html += '<button type="button" class="re-pg-btn" data-pg="prev"' + (page === 0 ? ' disabled' : '') + '>‹</button>';
      var pages = [];
      for (var i = 0; i < tp; i++) { if (i === 0 || i === tp - 1 || Math.abs(i - page) <= 1) pages.push(i); }
      var last = -1;
      pages.forEach(function (i) {
        if (i - last > 1) html += '<span class="re-pg-ellipsis">…</span>';
        html += '<button type="button" class="re-pg-btn' + (i === page ? ' on' : '') + '" data-pg="' + i + '">' + (i + 1) + '</button>';
        last = i;
      });
      html += '<button type="button" class="re-pg-btn" data-pg="next"' + (page === tp - 1 ? ' disabled' : '') + '>›</button>';
      html += '</div>';
      container.innerHTML = html;
    }

    function go(p) {
      p = Math.max(0, Math.min(totalPages() - 1, p));
      if (p === page) return;
      page = p;
      if (opts.onChange) opts.onChange(page);
      if (opts.scrollTo) {
        var el = typeof opts.scrollTo === 'string' ? document.querySelector(opts.scrollTo) : opts.scrollTo;
        if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }

    container.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pg]');
      if (!b || b.disabled) return;
      var v = b.getAttribute('data-pg');
      if (v === 'prev') go(page - 1);
      else if (v === 'next') go(page + 1);
      else go(parseInt(v, 10));
    });

    return {
      /* Registra el total, pinta el pager y devuelve sólo la página visible */
      slice: function (arr) {
        total = arr.length;
        if (page >= totalPages()) page = totalPages() - 1;
        if (page < 0) page = 0;
        render();
        return arr.slice(page * ps, page * ps + ps);
      },
      /* Para paginación en servidor: sólo registra el total y pinta */
      setTotal: function (n) {
        total = n;
        if (page >= totalPages()) page = totalPages() - 1;
        if (page < 0) page = 0;
        render();
      },
      reset: function () { page = 0; },
      page: function () { return page; },
      pageSize: function () { return ps; },
      range: function () { var s = page * ps; return { start: s, end: Math.min(s + ps, total) }; }
    };
  };
})();
