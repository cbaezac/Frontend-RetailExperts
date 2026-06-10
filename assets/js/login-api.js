(function () {
  var form = document.getElementById('login-form');
  var error = document.getElementById('login-error');
  var submit = form ? form.querySelector('button[type="submit"]') : null;

  window.validarLogin = function (event) {
    event.preventDefault();
    if (!form || !window.RetailAPI) return false;

    var username = document.getElementById('usuario').value.trim();
    var password = document.getElementById('password').value;
    if (error) {
      error.style.display = 'none';
      error.textContent = 'Usuario o contrasena incorrectos.';
    }
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Ingresando...';
    }

    window.RetailAPI.login(username, password)
      .then(function () {
        window.location.href = 'landing.html';
      })
      .catch(function () {
        if (error) error.style.display = 'block';
      })
      .finally(function () {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Ingresar';
        }
      });

    return false;
  };
})();
