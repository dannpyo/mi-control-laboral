# Reglas de dominio

`domain.js` contiene los vínculos iniciales, fechas locales, período administrativo, validaciones, valoración de jornadas y escalas informativas. No accede al DOM ni a IndexedDB. Las reglas se prueban con `node --test tests/domain.test.mjs`.

`js/app.js` presenta las cinco secciones y coordina las operaciones. Los horarios y tolerancias se copian en cada jornada nueva para conservar su contexto al editar la configuración.
