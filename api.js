(function () {
  var API_BASE_URL = 'https://api.retailexperts.cl';
  var TOKEN_KEY = 'retailexperts_web_token';
  var USER_KEY = 'retailexperts_web_user';

  function getToken() {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(window.localStorage.getItem(USER_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function setSession(payload) {
    if (!payload || !payload.token) throw new Error('Respuesta de login invalida');
    window.localStorage.setItem(TOKEN_KEY, payload.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user || payload.usuario || null));
  }

  function clearSession() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }

  function loginUrl() {
    return 'login.html';
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.href = loginUrl();
      return false;
    }
    return true;
  }

  function buildQuery(params) {
    var qs = new URLSearchParams();
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        value.forEach(function (item) {
          if (item !== undefined && item !== null && item !== '') qs.append(key, item);
        });
        return;
      }
      qs.set(key, value);
    });
    var out = qs.toString();
    return out ? '?' + out : '';
  }

  function request(path, options) {
    options = options || {};
    var headers = new Headers(options.headers || {});
    var token = getToken();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    return fetch(API_BASE_URL + path, Object.assign({}, options, { headers: headers }))
      .then(function (response) {
        if (response.status === 401) {
          clearSession();
          window.location.href = loginUrl();
          throw new Error('Sesion expirada');
        }
        if (!response.ok) {
          return response.text().then(function (text) {
            throw new Error(text || ('Error HTTP ' + response.status));
          });
        }
        return response;
      });
  }

  function requestJson(path, options) {
    return request(path, options).then(function (response) { return response.json(); });
  }

  function login(username, password) {
    return fetch(API_BASE_URL + '/web/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: username, password: password })
    }).then(function (response) {
      if (!response.ok) throw new Error('Usuario o contrasena incorrectos');
      return response.json();
    }).then(function (payload) {
      setSession(payload);
      return payload;
    });
  }

  window.RetailAPI = {
    baseUrl: API_BASE_URL,
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,
    requireAuth: requireAuth,
    buildQuery: buildQuery,
    request: request,
    requestJson: requestJson,
    login: login
  };
})();
