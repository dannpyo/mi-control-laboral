# Mi Control Laboral 2.0 · validación

12 de noviembre de 2026. Base `main`: `b1c4348`, con v1.1 fusionada. Rama independiente; no se fusiona ni se modifica Pages.

## Rediseño

- Paletas solicitadas claras/oscuras, tipografía del sistema, tarjetas compactas, botones contrastados y preferencia persistente por origen.
- Tres pestañas: Inicio, Calendario y Resumen. Configuración mediante icono de cabecera. Se elimina la pestaña Historial; últimas cinco jornadas relevantes en Inicio e histórico completo por fecha/vínculo en Calendario.
- Inicio con vínculo automático, reloj HH:mm:ss actualizado cada segundo, hora local del celular y zona esperada America/Asuncion visible. Si difiere, se muestra la zona real. Las horas almacenadas mantienen su precisión de minutos.
- Horas guardadas y botones deshabilitados tras marcar; la protección contra duplicados y revisiones transaccionales se conserva.
- Editor breve con ambas horas; los estados y detalles adicionales permanecen en Más opciones. Las ediciones conservan los campos históricos no modificados.
- Resumen sin estadísticas secundarias ni estimaciones repetidas de cero: tres contadores, saldo permitido, sanciones pertinentes y consulta de fechas confirmadas.
- Identificación explícita de normativa informativa pendiente de verificación institucional.

## Integridad de datos

Sin cambios en `js/modules/domain.js` ni `js/storage/db.js`. Mismo origen/start_url/scope, nombre/versión de IndexedDB, almacenes, claves y formato JSON versión 1. No hay migraciones ni modificaciones automáticas de registros históricos. Apariencia guardada separadamente en `localStorage` bajo `mi-control-laboral-theme`; no altera la configuración laboral ni el respaldo.

Service Worker actualizado a v2.0.0, con el módulo de presentación en el shell. Activa al cerrar las ventanas anteriores, sin forzar recargas ni limpiar IndexedDB. Sin servicios externos, datos personales ni dependencias nuevas de ejecución.

## Verificación aprobada

- **23 pruebas Node:** 20 reglas/regresiones intactas (tolerancias, escalas, períodos, omisiones, independencia, calendario y minutos) más reloj con segundos, selección automática por día y preferencia visual con almacenamiento disponible/no disponible.
- **Android emulado Pixel 7:** tres opciones inferiores, Configuración accesible, reloj visible y avance correcto; entrada por doble pulsación sin duplicados, salida, horas guardadas, corrección manual, controles adicionales plegados y clasificación de incidencia. Período y vínculo correctos; actualización de vínculo domingo/lunes y cambio de período al día 16.
- **Resumen:** contadores por vínculo, ausencia de estimaciones repetidas de cero, sanción/alerta preventiva y fechas de incidencia consultables.
- **Persistencia:** datos tras recarga y cierre/reapertura de Chromium, tema guardado y recuperado, JSON/CSV, importación, duplicados, validación atómica y protección de ediciones obsoletas entre pestañas.
- **Offline:** recarga, calendario, corrección manual y persistencia tras una nueva recarga. Manifest e instalabilidad Chromium sin errores.
- **Actualización v1.0 → 2.0 y v1.1 → 2.0:** se sirve la versión anterior real en el mismo origen, se crean datos sintéticos, se actualiza el worker y se comparan exactamente registros, historial, configuración y DB versión 1. JSON anterior probado sobre registros existentes y en perfil limpio; lectura offline posterior correcta.
- **Regresión móvil:** miércoles/V1, jueves/V2, domingo/V3 y lunes sin pendientes; excepción manual, filtros, situaciones especiales e indicadores por vínculo; alertas segunda/tercera; consulta de pantallas sin escrituras. Sin desbordamientos a 320/360/390/1440 px.
- Capturas de Inicio claro/oscuro y Resumen revisadas. Sin errores JavaScript/consola en los flujos.

Los tests con nombres v11 se mantienen como regresiones sobre la versión actual. Requieren Playwright y Chromium; las actualizaciones requieren disponer de los commits anteriores en Git. No acceden al navegador ni a los datos reales del usuario.

## Pendiente

Comprobar la versión 2.0 en un Android físico. La emulación verifica interfaz y eventos táctiles, pero no sustituye esa prueba ni reproduce el diálogo nativo de instalación del celular. No se despliega desde esta rama ni se cambia el hosting.
