# Correcciones v1.1 · validación

12 de noviembre de 2026. Base: `main` en `b59e66a`, que contiene v1.0. Corrección en rama independiente, sin modificar `main` ni la configuración existente de Pages.

## Calendario

- Solo muestra los vínculos programados para el día y los que ya tienen un registro en esa fecha, incluidas situaciones especiales.
- Miércoles 04/11/2026: V1; jueves 05/11: V2; domingo 08/11: V3; lunes 09/11 sin excepciones: ninguno.
- Registro excepcional secundario, sin modificar el horario semanal. Filtro propio Todos/V1/V2/V3.
- Indicadores V1/V2/V3 separados: verde exige jornada completa y validada; ámbar para completar/revisar; rojo para incidencia injustificada confirmada; borde gris para programación sin registro; azul para situaciones especiales. Los días no laborales sin registros no muestran indicadores de asistencia.
- Los feriados permanecen visibles al seleccionar la fecha, aunque no corresponda una jornada. Las incidencias futuras nunca aparecen como faltas.

## Resumen y tiempos

Tres tarjetas compactas con filtro por vínculo y cambio de período 16–15. Contadores, saldo disponible de la omisión permitida y alertas diferenciadas: preventiva al segundo caso; sancionable según la escala correspondiente. Las estimaciones de cero días y las estadísticas completas permanecen dentro de detalles expandibles.

Distingue jornadas programadas, con entrada y salida completas, con marcaciones incompletas, cerradas explícitamente, completas/validadas, excepcionales y sin registro que requieren revisión. Las categorías pueden solaparse (por ejemplo, una excepción puede estar completa y cerrada); no se deben sumar como si fueran excluyentes.

Horas calculadas exclusivamente con minutos enteros y mostradas como horas/minutos. La diferencia compara solo jornadas con ambas horas y sus horarios previstos, incluidas excepciones; no compara contra jornadas futuras ni se convierte en sanción. La programación del período completo incluye fechas futuras y excluye feriados libres/situaciones exentas. Se deriva de la configuración semanal actual; no se añade un histórico de cambios de programación permanente a los datos de v1.0.

Inicio del seguimiento: limita únicamente las jornadas transcurridas sin registro que deben revisarse. No crea faltas retroactivas, no oculta el calendario y no impide cargar fechas históricas en su período.

## Datos y actualización

- `js/storage/db.js` y la validación/formato de registros y respaldos permanecen compatibles con v1.0.
- IndexedDB continúa en versión 1, mismos almacenes y claves; sin migración, borrado ni reescritura automática de datos.
- Los registros vacíos guardados anteriormente se conservan: se clasifican como incompletos o pendientes, nunca como jornadas trabajadas.
- JSON conserva `format: mi-control-laboral`, `version: 1`. Importar coincidentes no los sobrescribe.
- Service Worker y recursos de entrada actualizados a v1.1.0; mantiene la activación al cerrar pestañas y caché solo de archivos estáticos.
- Sin servicios externos, datos personales en el código ni nuevas dependencias de ejecución. Datos de prueba sintéticos.

## Pruebas reproducibles

- `node --test tests/*.test.mjs`: 20 casos de reglas originales y correcciones. Tolerancias, períodos, escalas y separación entre vínculos sin cambios; además días de calendario, excepciones, estados visuales, métricas, formatos 10 h 59 min / 12 h 00 min / 11 h 30 min y diferencia comparable.
- `TEST_URL=http://localhost:8766/mi-control-laboral/ node tests/browser.cjs`: regresión de ingreso/edición/auditoría, marcaciones, filtros, respaldos JSON/CSV, importación, concurrencia, persistencia tras reiniciar Chromium, instalación y uso offline.
- `TEST_URL=http://localhost:8766/mi-control-laboral/ node tests/mobile-v11.cjs`: calendario por día y vínculo, excepción mediante interfaz, indicadores concurrentes y situaciones especiales, tarjetas compactas/expandibles, alertas segunda/tercera, horas y cambio de período. Comparación de registros antes/después de navegación para comprobar ausencia de escrituras. Sin desbordamiento a 320, 360, 390 y 1440 px, ni errores JavaScript/consola; lectura offline correcta. Captura móvil revisada.
- `node tests/upgrade-v11.cjs`: sirve v1.0 real del commit `e3e558e`, crea registros e historial sintéticos, actualiza en el mismo origen a v1.1 y compara exactamente registros, historial, configuración y versión de DB. Comprueba JSON v1.0 sobre datos existentes y en perfil vacío, así como lectura offline tras actualizar.
- `node tests/upgrade.cjs`: regresión de actualización desde la etapa inicial (`8c84ab3`) hasta v1.1.

Los tests de navegador requieren Playwright/Chromium como herramientas de desarrollo y el servidor local para los dos tests con TEST_URL. Los tests de actualización levantan su propio servidor y requieren el historial Git correspondiente. No actúan sobre el almacenamiento de un navegador personal.

## Límite pendiente

Se verifican Chromium y tamaños móviles simulados; queda pendiente la comprobación de v1.1 en el Android físico del usuario. No se ha publicado desde la rama de corrección ni cambiado Pages.
