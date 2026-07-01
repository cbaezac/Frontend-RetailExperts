window.ASISTENCIA = (function(){
  // Aun no conectado a datos reales de asistencia (planificado vs. realizado).
  // Se deja vacio a proposito para no mostrar cifras inventadas en produccion;
  // mantiene la misma forma que espera descargador-asistencia.html para que
  // conectar el backend real despues sea solo reemplazar este archivo.
  return { dates: [], clients: [], clientLabels: {}, locales: [], rows: [] };
})();
