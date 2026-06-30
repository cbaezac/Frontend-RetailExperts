// Logger de actividad compartido (demo en cliente).
// Al conectar el backend, reemplazar logEvent() por un POST a la API de auditoría.
// Agrega por DÍA + usuario + módulo + evento: cada interacción suma 1 en su contador del día.
(function (w) {
  var KEY = 're_activity_log';
  var MAX = 2000;
  function currentUser() {
    try { return localStorage.getItem('re_current_user') || 'invitado'; } catch (e) { return 'invitado'; }
  }
  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  // type: 'login' | 'logout' | 'modulo'
  // modulo: 'Acceso' | 'Descargador' | 'Galería' | 'Dashboards'
  // evento: detalle concreto (ej. 'Asistencia', 'Góndola', 'Resumen de Negocio')
  w.logEvent = function (modulo, evento, type) {
    try {
      var arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      var ts = Date.now();
      var day = dayKey(ts);
      var user = currentUser();
      var t = type || 'modulo';
      // buscar fila existente del mismo día/usuario/módulo/evento para sumar
      for (var i = 0; i < arr.length; i++) {
        var e = arr[i];
        if (e.day === day && e.user === user && e.modulo === modulo && e.evento === evento && e.type === t) {
          e.count = (e.count || 1) + 1;
          e.ts = ts; // última vez
          localStorage.setItem(KEY, JSON.stringify(arr));
          return;
        }
      }
      arr.push({ ts: ts, day: day, user: user, type: t, modulo: modulo, evento: evento || '', count: 1 });
      if (arr.length > MAX) arr = arr.slice(arr.length - MAX);
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {}
  };
})(window);
