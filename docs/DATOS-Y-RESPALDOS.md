# Datos y respaldos locales

## Alcance

Estas opciones se incorporan únicamente en Configuración → Datos y respaldos. No cambian las reglas laborales, las plantillas de Inicio/Calendario/Resumen, la navegación ni el CSS principal. Service Worker y recursos de entrada: v2.1.0. Sin servidores, sincronización en nube ni tareas con la aplicación cerrada.

## Carpeta y compatibilidad Android

El acceso automático requiere un contexto seguro (HTTPS o localhost), `showDirectoryPicker`, handles de directorio/archivo con las operaciones de lectura/escritura y permisos necesarias, y Web Locks para excluir escrituras concurrentes entre pestañas.

**No se garantiza que esté disponible en Android.** La existencia de Chrome, IndexedDB o de acceso a archivos mediante otros selectores no implica que el navegador permita seleccionar un directorio persistente. Si falta alguna capacidad, se muestra «no disponible», se mantiene Exportar JSON y se ofrece un recordatorio cada siete días en esta sección cuando se abre la aplicación. No hay notificación del sistema ni recordatorio con la PWA cerrada.

1. Pulsar Seleccionar carpeta de destino y autorizar lectura/escritura.
2. Activar Respaldo automático. Se puede desactivar sin perder la carpeta o los archivos.
3. Cambiar carpeta permite elegir otro destino; no mueve, elimina ni modifica los archivos anteriores.
4. Crear respaldo ahora permite verificar una copia o volver a solicitar permiso mediante una acción explícita.

El handle y las preferencias se guardan en `settings`, bajo la clave `backupSettings`, fuera de `config` y del esquema JSON. Al reabrir se consulta el permiso; nunca se presupone que Android lo conserve y nunca se ejecuta `requestPermission` automáticamente. Si falta permiso, el estado indica el problema y se puede autorizar desde Crear respaldo ahora, cambiar carpeta o exportar manualmente. Un fallo de estas operaciones no bloquea la consulta ni el guardado laboral.

## Escritura e integridad

Después de que una jornada se guarda en IndexedDB (entrada, salida o edición), se encola la operación de respaldo. También se consideran los cambios de configuración laboral y las importaciones que incorporan datos. El guardado original ya está confirmado: un fallo de respaldo no lo revierte.

La copia usa una sola transacción de lectura sobre jornadas y configuración, con una revisión global. Se genera el JSON de formato original (`format: mi-control-laboral`, `version: 1`), incluidos los historiales. No contiene handles ni permisos/preferencias de respaldo. La configuración de tema permanece separada, como antes.

Las escrituras se serializan en la instancia y entre pestañas con Web Locks. El nombre base es:

`MiControlLaboral_AAAA-MM-DD_HHMMSS.json`

Si ya existe, se usa un sufijo `_001`, `_002`, etc., sin reemplazarlo. La opción de agrupación crea subcarpetas `MiControlLaboral/AAAA-MM-DD` dentro de la carpeta elegida. Con agrupación activada no se crea otra copia si los datos son idénticos; se verifica de nuevo el archivo anterior. La comparación usa SHA-256 del contenido laboral completo, incluido su historial, sin incluir la fecha de exportación. Si el archivo fue cambiado o ya no existe, se crea otro archivo único sin alterar el anterior.

Tras escribir se cierra el stream, se vuelve a leer y se exige coincidencia exacta con el JSON generado. Solo entonces se actualiza la fecha del último respaldo verificado. Un archivo fallido o parcial no se marca como correcto y no se elimina automáticamente; el reintento utiliza otro nombre. No se implementa ninguna eliminación de archivos externos.

Estados:

- **Actualizado:** el último archivo verificado corresponde a la revisión actual de los datos.
- **Pendiente:** hay cambios sin copia verificada, falta seleccionar carpeta o existe la pausa posterior a una limpieza.
- **No disponible:** el navegador carece de las capacidades necesarias o no existe permiso vigente. La necesidad de respaldo sigue pendiente internamente.

Si cambian los datos mientras se escribe, la copia sigue siendo una versión consistente, pero el estado permanece pendiente para la nueva revisión. Cambiar de carpeta o borrar registros invalida la generación de copias en curso para impedir que publiquen un estado «actualizado» incorrecto.

La exportación manual conserva el botón existente. Se registra la fecha de solicitud para el recordatorio, pero **una descarga manual no se presenta como archivo verificado**: la aplicación no puede comprobar dónde ni si el usuario guardó la descarga. La fecha «último respaldo verificado» corresponde a archivos leídos mediante la API.

## Borrar todos los registros

1. Se muestra la cantidad de jornadas y la advertencia de que solo podrán recuperarse mediante un respaldo.
2. Se ofrecen descargar JSON o crear una copia en la carpeta autorizada antes de continuar. La descarga requiere comprobar que se guardó el archivo; la copia en carpeta se verifica.
3. Primera confirmación mediante botón.
4. Segunda confirmación escribiendo exactamente `BORRAR` y pulsando Borrar definitivamente.
5. Cancelar o cerrar el diálogo en cualquier paso no elimina datos.

El borrado limpia **solo `records`**, incluyendo historiales anidados. No borra la base ni los almacenes; conserva vínculos, horarios, tolerancias, feriados, inicio del seguimiento, tema y ajustes/handle de respaldo. Si cambian los datos en otra pestaña durante la confirmación, se cancela y se exige revisar/confirmar de nuevo.

La limpieza y la pausa del respaldo se guardan en la misma transacción. No se crea ningún respaldo automático vacío, no se restauran datos al reiniciar y no se modifican archivos existentes. Las copias automáticas permanecen en pausa aunque se agreguen nuevas jornadas, se cambie carpeta o se vuelva a activar la opción. Para reanudar debe elegirse explícitamente Crear respaldo ahora; si no hay jornadas, se pide confirmar que la nueva copia será vacía. Nunca se sobrescribe el último respaldo completo.

Inicio queda sin marcaciones, Calendario conserva programación/feriados sin los registros borrados y Resumen muestra cero incidencias. El inicio del seguimiento se conserva y las fechas programadas sin registro siguen siendo distintas de incidencias oficiales.

## Persistencia y actualización

IndexedDB sigue llamándose `mi-control-laboral`, versión 1, con los mismos almacenes y claves de jornadas. Se añaden solo metadatos necesarios en `settings`: preferencias/handle y revisión global. Los JSON anteriores continúan importándose; las preferencias de respaldo del dispositivo actual no se sobrescriben al restaurar la configuración laboral.

Para actualizar: abrir con conexión, esperar que el nuevo worker se instale, cerrar las ventanas anteriores y reabrir. No hay recarga forzada ni modificación manual de Pages. La caché contiene únicamente archivos estáticos, nunca registros, respaldos ni handles.

## Verificación

- **41 pruebas Node**, incluidas las reglas laborales existentes y 12 casos del motor de respaldo: capacidades, permisos concedidos/denegados/revocados, cierre/verificación, cola y nombres únicos, deduplicación, errores/reintentos, copias previas/archivos ajenos, borrado durante escritura y pausa posterior, estado vacío solo por decisión manual, y recordatorio semanal.
- **`tests/data-controls.cjs`**: Android emulado con selector/permisos simulados y handles OPFS reales. Comprueba persistencia del handle en IndexedDB al recargar, copia tras entrada/salida/edición, JSON compatible e importación en perfil vacío, errores sin pérdida laboral, doble confirmación, cancelación en ambos pasos, cambio concurrente, borrado efectivo y conservación completa de configuración/tema/backup, contadores antes/después, copias históricas intactas, pausa incluso con nuevas jornadas, fallback semanal y uso offline.
- Regresiones de interfaz, incidencias automáticas, calendario y respaldo JSON/CSV.
- Actualización desde versiones previas: comparación exacta de registros, configuración e historial, IndexedDB versión 1 y uso offline.

Los archivos de prueba contienen únicamente datos sintéticos; no se guardan respaldos reales en el repositorio.

### Pendiente en el teléfono

Probar el navegador/PWA exactos del usuario: disponibilidad real de `showDirectoryPicker`, selección de una carpeta Android mediante el selector nativo, lectura/escritura sobre almacenamiento del dispositivo, revocación y persistencia efectiva del permiso tras cerrar y reabrir la PWA. Las pruebas con mocks/OPFS no certifican el soporte del selector nativo ni que Android conserve sus permisos.
