# Margen preventivo de incidencias

## Cálculo de presentación

La mejora lee exclusivamente los contadores computables que ya entrega `stats()`. No modifica `domain.js`, clasificación de jornadas, justificaciones, tolerancias de lluvia, período ni escalas. El nuevo módulo `margins.js` no escribe ni clasifica registros.

El margen expresa cuántas incidencias adicionales podrían ocurrir **sin llegar al primer umbral sancionable**:

| Tipo | Primer umbral | Margen con 0 | Con 1 | Con 2 | Con 3 |
| --- | --- | --- | --- | --- | --- |
| Tardanzas | 3 | 2 | 1 | 0, próxima | 0, alcanzado |
| Salidas anticipadas | 3 | 2 | 1 | 0, próxima | 0, alcanzado |
| Omisiones | 2 | 1 | 0, próxima | 0, alcanzado | 0, alcanzado |

Se calcula como `max(0, umbral - 1 - computables)`. Las justificadas no consumen margen porque no forman parte del contador computable. Cada vínculo, categoría y período 16–15 se calcula por separado; no se suman entre sí.

Colores: verde si quedan más de una; ámbar si queda exactamente una; rojo si queda cero. Por eso cero omisiones se muestra ámbar (queda una permitida), no rojo. El texto distingue «La próxima incidencia podría generar descuento» de «Umbral de posible descuento alcanzado». Nunca indica que haya un descuento o multa efectivamente aplicado.

## Interfaz

- **Resumen:** sección compacta Margen de incidencias debajo de los tres contadores, con categoría, computables, margen y mensaje pertinente. Reutiliza la paleta semántica del diseño corporativo en ambos modos. Sustituye el aviso genérico de segunda incidencia por la información precisa del margen, evitando duplicación.
- **Inicio:** una sola advertencia breve del vínculo seleccionado si alguna categoría tiene margen cero o umbral alcanzado. No muestra aviso por margen de uno/dos; el ámbar permanece visible en Resumen para consulta.
- **Calendario:** conserva las incidencias de la jornada y añade, solo en la tarjeta seleccionada cuando hay aporte computable, su contribución y total del período de esa fecha. Si solo hay incidencias justificadas, aclara que no suman. No añade avisos a las celdas mensuales.

Los recálculos existentes al registrar, editar, justificar/desjustificar, cargar una excepción o pasar al día 16 alimentan inmediatamente la presentación nueva. No hay tablas persistidas de márgenes ni datos históricos regrabados.

## Compatibilidad

Sin cambios en IndexedDB, su versión/origen, configuración, historial, formato JSON ni motores de respaldo/importación. Sin permisos, servicios externos, pestañas ni funciones laborales adicionales. Service Worker y recursos de entrada actualizados a v2.2.1, con el módulo de márgenes en el shell offline. GitHub Pages no se modifica.

## Validación

- **53 pruebas Node:** 49 regresiones y cuatro casos nuevos sobre límites, semáforo, mensajes y lectura exclusiva de computables, sin mutación de datos.
- **`tests/margins.cjs`:** prueba 0/1/2/3 en las tres categorías y los tres vínculos en Android emulado. Comprueba dos tardanzas → próxima incidencia; tres → umbral y estimación de un día; una omisión → próxima; dos → umbral. Verifica marcación rápida, edición, marcar/retirar justificación y excepción, aislamiento entre vínculos, efecto del día seleccionado sin mensajes en las celdas y ausencia de advertencia en Inicio sin riesgo inmediato.
- Reinicio del período mediante reloj al pasar del 15 al 16; registros conservados exactamente. Modos claro/oscuro, sin desbordamiento a 320/390/1440 px y uso offline tras recarga.
- Regresiones de calendario, asistencia obligatoria, registro/edición/auditoría, JSON/CSV, respaldos automáticos y limpieza segura.
- Actualización desde versiones anteriores y etapa inicial: registros/configuración/historial intactos, IndexedDB versión 1 y recarga offline.

Comandos: `node --test tests/*.test.mjs` y, con servidor activo, `TEST_URL=http://localhost:8000/ node tests/margins.cjs` (igual mecanismo de Chromium/Playwright de los demás tests). Usa perfiles y datos sintéticos, sin acceder al navegador personal. Queda pendiente comprobar esta presentación en el Android físico del usuario.
