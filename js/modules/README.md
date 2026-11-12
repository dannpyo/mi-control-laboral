# Reglas y presentación

`domain.js` conserva vínculos, fechas locales, período administrativo, validaciones, valoración de jornadas y escalas informativas. No accede al DOM ni a IndexedDB. No se modifica en el rediseño v2.0.

`presentation.js` contiene el formato del reloj local, selección automática del vínculo y lectura de la preferencia visual. No modifica datos laborales. La apariencia se guarda por origen fuera del formato de respaldo.

`js/app.js` presenta tres pestañas (Inicio, Calendario, Resumen) y Configuración desde la cabecera. Mantiene la coordinación con la capa de almacenamiento existente. Las reglas y funciones de presentación se verifican con `node --test tests/*.test.mjs`.
