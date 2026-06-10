(function () {
  if (!window.RetailAPI || !window.RetailAPI.requireAuth()) return;

  var logout = document.querySelector('.btn-logout');
  if (logout) {
    logout.addEventListener('click', function (event) {
      event.preventDefault();
      window.RetailAPI.clearSession();
      window.location.href = 'index.html';
    });
  }
})();
