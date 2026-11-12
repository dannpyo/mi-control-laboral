# Asistencia obligatoria y editor simplificado

## Criterios

Vínculo 1 DGVS: miércoles 07:30–19:30. Vínculo 2 DGVS: jueves 07:30–19:30. Vínculo 3 HGI: domingo 07:00–19:00. Se mantienen las configuraciones y horarios históricos guardados; los nombres predeterminados anteriores se presentan con DGVS/HGI sin reescribir la configuración existente ni los nombres personalizados.

Toda jornada programada requiere asistencia salvo excepción. No se generan incidencias en fechas futuras. Tardanzas/salidas anticipadas se calculan de sus horas, con tolerancias de 15 minutos o lluvia 60 totales, inclusivas, sin compensación con salidas posteriores.

**Solo tras superar la hora prevista de salida** (no en el instante exacto) se evalúa la falta de marcaciones:

- Salida sin entrada: una omisión de entrada.
- Entrada sin salida: una omisión de salida.
- Ninguna marcación: Posible ausencia. No suma dos omisiones ni se declara injustificada automáticamente.

La falta de registro completo no depende de campos oficiales, cierre ni confirmaciones. En «Justificar / excepción» se pueden aplicar justificaciones independientes de tardanza, salida u omisión; y una situación de permiso, vacaciones, reposo médico, feriado libre/trabajado, cambio de guardia o ausencia justificada. Para una posible ausencia se incluyen también ausencia injustificada y doble omisión **explícitas**.

Las excepciones eximentes evitan ausencia y omisiones. Feriado trabajado mantiene la obligación. Las incidencias justificadas permanecen detectadas y en el historial, pero no suman sus contadores sancionables. No se inventa una escala de sanciones por ausencia.

## Datos calculados y seguimiento

Las jornadas programadas sin fila se construyen únicamente en memoria, por fecha/vínculo y período. No se guardan automáticamente ni se incluyen en exportaciones/respaldos. Un día sin jornada programada ni excepción registrada no genera incidencias.

Se conserva el inicio del seguimiento: limita las jornadas **nunca registradas** que se evalúan. No se generan posibles ausencias anteriores a ese límite sin información. Los registros históricos ya existentes se recalculan en su fecha/período aunque sean anteriores al inicio. El usuario puede ajustar ese límite en Configuración para ampliar el seguimiento histórico, sin alterar horas o registros.

Inicio/Calendario/Resumen comparten la misma valoración. Resumen añade posibles ausencias, mantiene una omisión permitida y las escalas informativas por vínculo del 16 al 15. Su detalle incluye fechas calculadas para clasificarlas con un clic. El reloj actualiza el estado al superar la salida, sin navegación y sin interrumpir el editor. Cambiar de período conserva los datos anteriores.

## Editor

Solo fecha, vínculo, entrada, salida, Guardar y el desplegable «Justificar / excepción». Dentro se agrupan las justificaciones, la situación y lluvia. No hay entrada/salida oficial, cierre, selector obligatorio de revisión, edición de horarios administrativos ni formulario extenso.

Las notas, el horario guardado, los estados administrativos antiguos y la auditoría se conservan en el registro aunque ya no sean campos editables. Una edición explícita agrega una nueva entrada al historial. Las justificaciones existentes no se desmarcan al abrir o guardar el formulario.

## Compatibilidad

No cambia IndexedDB (nombre, origen, versión, almacenes ni claves). No se ejecutan migraciones destructivas, barridos de registros ni reescrituras al actualizar o consultar. Se recalculan resultados, no horas guardadas.

Se aceptan JSON anteriores con sus campos originales y justificaciones. El formato sigue en versión 1. La nueva propiedad opcional `omissionJustified` expresa la justificación de omisiones; `double-omission` representa la clasificación explícita de doble omisión. Las dobles omisiones vacías confirmadas en versiones anteriores se conservan como clasificación histórica. El antiguo tipo «pending» ya no exime de calcular asistencia ni obliga a revisar antes de marcar.

El motor de respaldos, sus permisos, pausa de limpieza y exportaciones se conserva. Solo se respaldan filas reales. No hay datos personales en el código ni servicios nuevos. Service Worker y recursos de entrada: v2.2.0. CSS corporativo, navegación y Pages sin cambios.

## Pruebas

- **49 pruebas Node:** 41 regresiones ajustadas a las reglas sustituidas y ocho casos específicos de asistencia obligatoria. Cubren ejemplos, tolerancias, omisiones, posible ausencia, futuro, excepciones, justificaciones, períodos, independencia, filas calculadas sin mutar datos e importación de estados históricos.
- Ejemplo 29/10/2026 V2, entrada 08:08 sin salida: **1 tardanza (38 min) y 1 omisión de salida**.
- Ejemplo 18/10/2026 V3, salida 19:07 sin entrada: **1 omisión de entrada**, sin salida anticipada.
- Límite estricto: 19:30:00 todavía no genera omisión; 19:30:01 sí, si corresponde.
- **`tests/mandatory-attendance.cjs`:** UI Android emulada, resumen de ejemplos, edición breve sin controles administrativos, conservación de horas/notas/auditoría, justificar omisión/tardanza, permiso/doble omisión/ausencia explícita, recálculo automático al superar salida, período, JSON sin filas calculadas, importación y offline. Sin desbordamiento a 320/390/1440 px.
- Regresiones de registro rápido, reloj, temas, detección de incidencias, calendario, respaldo automático y limpieza segura.
- Actualización desde versiones previas reales: comparación exacta de registros, configuración e historial, con IndexedDB versión 1 y uso offline.

La prueba de esta versión en Android físico queda pendiente; las pruebas móviles utilizan Chromium emulado. No se modifica ni fusiona automáticamente la rama principal ni se cambia Pages.
