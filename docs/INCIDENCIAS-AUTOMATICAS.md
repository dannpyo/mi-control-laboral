# Corrección de incidencias automáticas · 2.0.1

## Comportamiento

Las entradas fuera de la tolerancia y las salidas anteriores al horario previsto se detectan y computan automáticamente, sin seleccionar «Injustificada». Solo marcar la casilla de justificación excluye la incidencia del contador de sanciones; no la elimina del historial ni del total detectado. Desmarcarla restaura su cómputo. Las casillas se muestran únicamente cuando se detecta la incidencia, dentro de Más opciones, y responden al cambiar hora, horario o lluvia.

Inicio, Calendario y Resumen usan la misma valoración. El contador principal sigue siendo computable; el detalle muestra total detectado, justificado y computable, incluidas las fechas justificadas. «Llegada tardía» informa minutos desde la hora programada, no desde el límite de tolerancia. Los registros incompletos identifican Falta entrada, Falta salida o Sin registrar; no generan omisiones oficiales ni ausencias automáticamente. No hay contador general de pendientes en Resumen.

Se conservan horarios, tolerancias inclusivas de 15/60 minutos, período 16–15 y escalas por vínculo y tipo. Las sanciones siguen siendo estimaciones informativas.

## Compatibilidad sin reescrituras

Se mantienen el nombre y versión de IndexedDB, los almacenes, las claves y el formato JSON versión 1. `js/storage/db.js` no cambia.

Los campos existentes `lateState` y `earlyState` siguen siendo compatibles:

- `justified`: casilla marcada, incidencia detectada pero no computable.
- `unjustified`: casilla desmarcada, incidencia computable si se detecta.
- `pending` heredado: se interpreta al leer como no justificada, por lo que cuenta si hay incidencia. No se presenta como tardanza pendiente ni exige acción del usuario.

Es una adaptación lógica de lectura, no una migración destructiva. No se recorren ni reescriben registros y no se modifica la auditoría anterior. Al editar explícitamente se guardan los valores de las casillas usando los campos existentes y se añade una entrada normal al historial. Se preservan justificaciones aunque la casilla quede temporalmente oculta al cambiar una hora o la condición de lluvia.

Service Worker y recursos de entrada en v2.0.1; mismo diseño, origen y alcance. No hay cambios de CSS, hosting, permisos, servicios ni dependencias de ejecución.

## Pruebas aprobadas

- **29 pruebas Node**: regresiones y seis nuevos casos específicos, incluidos el ejemplo obligatorio 09:30–19:31 (120 minutos, una tardanza computable, ninguna salida anticipada), límites 07:45/07:46 y lluvia 08:30/08:31, justificación reversible, independencia entre tardanza/salida, estados heredados y registros incompletos sin omisiones.
- **`tests/automatic-incidents.cjs`**: ejemplo completo mediante interfaz Android emulada, aparición condicional de casillas, marcar/desmarcar y persistir, contadores en Inicio/Resumen, estados del Calendario, detalle detectado/justificado/computable, historial intacto, lluvia y las tres etiquetas de incompletos. Lectura offline aprobada.
- **Regresión de interfaz**: registro rápido, edición breve, exportación/importación JSON/CSV, duplicados, concurrencia, reinicio de navegador, temas, instalación Chromium y uso offline.
- **Regresión móvil**: calendario por vínculo/día, excepciones, colores, filtros, períodos, alertas y consulta sin escrituras, de 320 a 1440 px.
- **Actualización real desde v1.0, v1.1 y v2.0**: comparación exacta de registros, configuración e historial; IndexedDB sigue en versión 1. El estado heredado `pending` pasa a computarse sin reescritura. JSON previo probado sobre registros existentes y perfil vacío; funcionamiento offline. Regresión desde la etapa inicial también aprobada.

Comandos en README. La verificación se realiza con Chromium y emulación Android; queda pendiente probar esta corrección en el Android físico del usuario. No se modifica GitHub Pages ni se fusiona automáticamente ningún PR.
