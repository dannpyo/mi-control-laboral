# Reglas y presentación

`domain.js` contiene vínculos, fechas locales, período administrativo, validaciones, programación obligatoria calculada, detección automática de incidencias y escalas informativas. Las filas virtuales se construyen en memoria para evaluar jornadas sin registro; no se guardan ni se exportan. Las omisiones se deducen de las horas tras superar la salida prevista; los campos administrativos anteriores se conservan como datos históricos, sin exigirlos en la interfaz.

`presentation.js` contiene el reloj local, selección automática del vínculo y preferencia visual. No modifica registros. `js/app.js` coordina las tres pestañas, el editor breve y Configuración. El cálculo de horarios no accede al DOM ni a IndexedDB. Pruebas: `node --test tests/*.test.mjs`.

Criterios y compatibilidad: `docs/ASISTENCIA-OBLIGATORIA.md`.
