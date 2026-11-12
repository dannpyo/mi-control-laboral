# Validación de la etapa 1

Verificación automatizada con Chromium y Playwright el 12 de noviembre de 2026.

- JavaScript: comprobación de sintaxis de `app.js` y `sw.js` correcta.
- Servido bajo `/mi-control-laboral/`, simulando la subruta de GitHub Pages.
- Manifest interpretado sin errores; identidad, inicio y alcance resueltos a la subruta.
- Chromium en perfil persistente: `Page.getInstallabilityErrors` devolvió lista vacía.
- Service Worker activo; nueve recursos esenciales almacenados en caché.
- Recarga sin conexión correcta tanto en `/mi-control-laboral/` como en `/mi-control-laboral/index.html`.
- Móvil 390 × 844 y escritorio 1440 × 1000: sin desbordamiento horizontal. Capturas revisadas.
- Sin errores de consola, excepciones JavaScript ni respuestas HTTP fallidas.
- Sin bases IndexedDB creadas, formularios ni funcionalidades laborales.

La instalación en un Android físico y la publicación real en GitHub Pages quedan pendientes; no se activó hosting. El repositorio privado existente se integra mediante una rama de trabajo y un Pull Request hacia `main`; se conserva el texto del README original.

Los iconos PNG tienen tamaños 192, 512 y 180 px; la versión maskable de 512 px mantiene el dibujo dentro de la zona segura central. Fuente SVG incluida.
