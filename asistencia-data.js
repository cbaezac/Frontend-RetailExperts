window.ASISTENCIA = (function(){
  var dates = [];
  var today = new Date();
  for (var i = 29; i >= 0; i--) {
    var d = new Date(today.getTime() - i * 86400000);
    var iso = d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
    dates.push(iso);
  }

  var locales = [
    ['cencosud','CEN001','Santa Isabel Providencia','RM1'],
    ['cencosud','CEN002','Santa Isabel Las Condes','RM2'],
    ['cencosud','CEN003','Jumbo Costanera','RM3'],
    ['smu','SMU001','Unimarc Santiago Centro','RM4'],
    ['smu','SMU002','Unimarc Express Ñuñoa','RM5'],
    ['smu','SMU003','Unimarc Concepción','Concepcion A'],
    ['walmart','WMT001','Líder Maipú','RM9'],
    ['walmart','WMT002','Líder Express Pudahuel','RM10']
  ];

  var rows = [];
  var clients = ['reponedor'];
  var clientLabels = {reponedor: 'Reponedor'};

  for (var di = 0; di < dates.length; di++) {
    for (var li = 0; li < locales.length; li++) {
      var plan = (di % 2 === 0 || li % 3 !== 0) ? 1 : 0;
      var real = plan === 1 ? (Math.random() > 0.25 ? 1 : 0) : 0;
      rows.push([di, li, 0, plan, real]);
    }
  }

  return { dates: dates, clients: clients, clientLabels: clientLabels, locales: locales, rows: rows };
})();
