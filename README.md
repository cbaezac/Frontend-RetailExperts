# Frontend Retail Experts

Sitio web estatico de Retail Experts para publicar en Netlify. Las paginas publicas viven como HTML directo y las pantallas privadas se conectan al backend en:

```text
https://api.retailexperts.cl
```

## Paginas conectadas

- `login.html`: autentica contra `POST /web/auth/login`.
- `landing.html`: valida sesion local antes de entrar.
- `galeria.html`: carga filtros y fotografias reales desde `/web/galeria/*`.
- `dashboards.html`: muestra resumen operativo desde `/web/dashboard/resumen`.
- `descargador-levantamientos.html`: descarga CSV desde `/web/base-datos/productos.csv`.

## Desarrollo local

No requiere build. Para probarlo localmente:

```bash
python3 -m http.server 8080
```

Luego abre:

```text
http://localhost:8080/login.html
```

El login usa email y contrasena. Por ejemplo, un usuario admin inicial es:

```text
email: cbaeza@retailexperts.cl
```

## Deploy en Netlify

Como es un sitio estatico, se puede desplegar subiendo la carpeta completa o conectando este repositorio a Netlify. No hay comando de build ni carpeta de salida especial.

## Archivos de integracion

Los scripts comunes viven en `assets/js/`:

- `assets/js/api.js`: cliente compartido para token, sesion y llamadas HTTP.
- `assets/js/login-api.js`: reemplaza el login hardcodeado por login real.
- `assets/js/landing-api.js`: cierre de sesion y proteccion de landing.
- `assets/js/galeria-api.js`: filtros, carga, seleccion y descarga de fotos.
- `assets/js/dashboards-api.js`: KPIs y tablas resumen.
- `assets/js/descargador-api.js`: filtros y descarga CSV.
