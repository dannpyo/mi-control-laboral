# Validación de Mi Control Laboral 1.0

Fecha: 12 de noviembre de 2026. Rama creada desde la última `main` disponible (`8c84ab3`), que ya contiene la estructura PWA de la etapa 1. No se activó GitHub Pages.

## Reglas: 12 pruebas automatizadas aprobadas

Ejecutadas con `node --test tests/domain.test.mjs`:

- 07:45/07:46 y 08:30/08:31 con lluvia; los 60 minutos son totales e inclusivos.
- Salida a la hora prevista o antes; no compensar tardanza con una salida posterior.
- Inicio y cierre del período en días 16/15, cambio anual y febrero bisiesto.
- Independencia por vínculo, tipo y período, sin eliminar registros al cambiar el período.
- Justificaciones: solo injustificadas suman; pendientes y justificadas se separan.
- Omisiones oficiales explícitas: jornada revisada/cerrada, horario transcurrido; dos omisiones posibles en un día; horas personales vacías no generan omisiones.
- Escalas completas de omisiones, tardanzas y salidas anticipadas.
- Feriado libre por defecto, excepción trabajada por vínculo y exclusión de fechas futuras.
- Situaciones exentas y ausencia injustificada exclusivamente explícita.
- Horario y tolerancias históricos conservados al modificar la configuración.
- Validación de fechas, horarios, estados y configuración.
- Jornadas transcurridas sin registro: se señalan para revisar, sin inventar faltas ni omisiones.

## Pruebas de navegador aprobadas

`tests/browser.cjs`, Chromium/Playwright, bajo `/mi-control-laboral/`, zona horaria America/Asuncion, con datos sintéticos y perfiles temporales:

- Ingreso manual, observación con texto HTML tratado como texto y persistencia en IndexedDB.
- Edición con auditoría de valores anteriores/posteriores.
- Resumen independiente por vínculo y cambio de filtro al período que comienza el 16.
- Marcación de entrada y salida con hora del dispositivo; repetir entrada no duplica ni sobrescribe. Los estados oficiales permanecen separados.
- Configuración de feriados y excepción por fecha/vínculo.
- Exportaciones JSON y CSV descargadas y verificadas.
- Importación repetida conserva coincidentes; duplicados internos y datos inválidos se rechazan antes de escribir.
- Ediciones desactualizadas se rechazan mediante revisión transaccional.
- Importación en un perfil limpio; restauración opcional de configuración.
- Persistencia tras cerrar y volver a abrir Chromium con el mismo perfil.
- Manifest sin errores y comprobación Chromium de instalación sin errores en perfil persistente.
- Recarga offline, lectura y edición offline, nueva recarga conservando el cambio.
- Cinco secciones sin desbordamiento horizontal a 390 × 844; vista de escritorio 1440 × 1000 y capturas revisadas.
- Sin excepciones JavaScript ni errores de consola.

## Actualización desde la etapa 1 aprobada

`tests/upgrade.cjs` sirve primero la versión del commit `8c84ab3` con su Service Worker `v1`, después la nueva versión en el mismo origen. Se comprobó que la primera recarga usa el CSS y JavaScript nuevos de forma coherente, que el nuevo worker espera hasta cerrar la pestaña, que IndexedDB se conserva y que la siguiente carga funciona offline en `v1.0.0`.

## Alcance y comprobaciones pendientes

No se probó todavía en un Android físico ni en un sitio Pages publicado. Los feriados se cargan manualmente: no se ha asumido un país, una lista normativa ni un servicio externo. Las reglas de sanción son las aportadas por el usuario y no se validan como decisiones oficiales.

Las pruebas no añaden datos reales al repositorio. No hay dependencias de ejecución, cambios en los iconos originales ni servicios externos. El Service Worker conserva el mecanismo existente, con versión de caché `v1.0.0` y los dos módulos nuevos en el shell. IndexedDB queda fuera de la caché y se conserva al actualizar.
