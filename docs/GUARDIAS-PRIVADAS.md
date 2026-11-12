# Guardias privadas

Módulo independiente del control DGVS/HGI. No tiene asistencia obligatoria, tolerancias, incidencias ni sanciones. No modifica los períodos laborales del 16 al 15 ni crea guardias automáticamente.

## Uso

La cuarta pestaña **Guardias** abre **Guardias privadas**. Selecciona una liquidación con la lista o las flechas y pulsa **Agregar guardia**. Solo se solicitan entrada y salida completas, en fecha y hora de Paraguay. La salida debe ser posterior a la entrada; se admiten noches y varios días. El formulario muestra duración, horas normales, horas de fin de semana e importe. Las fechas idénticas de una guardia existente se rechazan como duplicadas.

Cada liquidación muestra cantidad de guardias que aportaron minutos, duración correspondiente, total bruto estimado, inicio/cierre exactos y ventana de factura. La lista indica el aporte de cada guardia a ese período y, si cruza un cierre, su duración e importe totales. **Editar guardia** modifica ese único registro y actualiza todas sus liquidaciones. **Eliminar guardia** requiere confirmación y retira todos sus aportes.

Configuración tiene un desplegable independiente **Guardias privadas · tarifas y liquidación**. No altera los formularios ni los ajustes del control laboral. Se conservan las paletas clara/oscura y la navegación móvil; no se añaden dependencias, servicios ni permisos.

## Cálculos y fechas

- Precisión: minutos enteros, sin segundos. Las entradas `YYYY-MM-DDTHH:mm` representan fechas civiles de Paraguay. No se convierten a `toISOString()` ni a la zona del navegador. El valor inicial del formulario se obtiene con `America/Asuncion`. La auditoría sí usa un instante ISO UTC.
- Normal: **Gs. 44.000/h**, desde lunes 07:00 hasta sábado 07:01, excluyendo este último instante; sábado 07:00–07:01 es normal.
- Fin de semana: **Gs. 49.500/h**, desde sábado 07:01 hasta lunes 07:00, excluyendo este último instante.
- Todos los intervalos son **[inicio, cierre)**. Se divide cada guardia en cambios de tarifa y cierres de liquidación. Un minuto pertenece a un solo tramo y un solo período.
- El numerador monetario es `BigInt(minutos) × tarifa_entera`, con denominador 60. Se suman las fracciones antes de redondear. El total de cada guardia se redondea al guaraní más próximo; medio guaraní sube (`(numerador + 30) / 60`).
- Para distribuir entre períodos, se toma la parte entera de cada aporte y se distribuyen los guaraníes restantes entre los mayores restos; en empate, primero el período cronológicamente anterior. Así, la suma de los importes atribuidos coincide **exactamente** con el total de la guardia. Un aporte puede variar Gs. 1 frente a redondearlo aisladamente. Los tramos internos mantienen fracciones exactas; no se redondean uno a uno.
- El total del período suma los aportes enteros de sus guardias; no vuelve a redondear horas ni dinero. Las horas se muestran como horas y minutos, sin truncar una fracción decimal.

Ejemplos con tarifas iniciales:

| Guardia | Duración / tarifa | Total |
| --- | --- | ---: |
| Lunes 09/11/2026 19:00 → martes 10/11 07:00 | 12 h normales | Gs. 528.000 |
| Viernes 13/11/2026 19:30 → sábado 14/11 07:00 | 11 h 30 normales | Gs. 506.000 |
| Sábado 14/11/2026 19:00 → domingo 15/11 07:00 | 12 h fin de semana | Gs. 594.000 |
| Sábado 14/11/2026 07:00 → 07:02 | 1 min normal + 1 min fin de semana | Gs. 1.558 |

**Ejemplo obligatorio:** 05/12/2026 19:00 → 06/12/2026 07:00 se guarda una sola vez. Aporta 5 h / **Gs. 247.500** al 06/11–05/12 y 7 h / **Gs. 346.500** al 06/12–05/01. Total **Gs. 594.000**.

Las tarifas se guardan como instantánea en cada guardia. Cambiar Configuración afecta solo guardias nuevas. Editar sus horas conserva las tarifas originales. Si difieren de las actuales, el editor ofrece **Recalcular con tarifas actuales**: pide confirmación, muestra el nuevo importe y solo lo persiste al guardar. Cancelar el formulario descarta el recálculo. La auditoría conserva los valores anteriores y posteriores.

## Liquidación y facturación

El patrón inicial es día 6 a las 00:00. El período `[06/11/2026 00:00, 06/12/2026 00:00)` se muestra **06/11/2026 – 05/12/2026**, con cierre exclusivo explícito en el detalle. Su factura se presenta del **10/12/2026 al 15/12/2026**. Las fechas de factura son únicamente informativas.

- **Patrón futuro:** los períodos anteriores y el actual conservan sus límites y ventanas. El período siguiente comienza en el cierre actual; su próximo cierre usa el nuevo día/hora del siguiente mes calendario. Puede existir un período de transición más largo o corto. Ejemplo: cambiar el día 6 a día 10 durante noviembre conserva el cierre 06/12; la siguiente liquidación va de 06/12 a 10/01. Luego continúa día 10. Días inexistentes (p. ej. 31 en febrero) se ajustan al último día del mes.
- **Cambio solo de facturación:** conserva todos los límites, incluso los ajustados individualmente; aplica los nuevos días de factura únicamente a períodos futuros.
- **Ajuste individual:** en **Fechas del período / factura** se editan inicio, cierre exclusivo y fechas exactas de factura. Cambiar el inicio ajusta el cierre anterior; cambiar el cierre ajusta el inicio siguiente, en una misma operación. No quedan huecos ni superposiciones. Los períodos vecinos deben conservar duración positiva; para un desplazamiento que los atraviese, ajusta primero sus otros límites.
- Si un ajuste individual afecta períodos pasados o guardias guardadas, pide confirmación antes de guardar. Un patrón futuro pide confirmación si redistribuye guardias futuras o reemplaza ajustes individuales. No cambia horas ni tarifas de las guardias. Se conserva la auditoría de los patrones y ajustes previos.
- Una modificación individual conserva las ventanas de factura de sus vecinos; se pueden ajustar explícitamente desde cada período. El patrón futuro nuevo puede reemplazar ventanas futuras individuales, previa confirmación. Nunca reescribe ventanas de períodos anteriores ni del actual.
- Abrir un período sin guardias no inserta guardias vacías. La agenda de liquidaciones se extiende cuando hace falta, respetando el patrón histórico del extremo correspondiente.

## Persistencia, respaldos e importación

Se mantiene **IndexedDB `mi-control-laboral`, versión 1**, y los mismos almacenes `records` y `settings`. El módulo usa una clave separada `settings.privateGuards` con guardias, tarifas, agenda de liquidaciones, ventanas y auditoría. No migra ni reescribe jornadas laborales. Los guardados son transaccionales y comprueban revisión para evitar sobrescribir una edición de otra pestaña.

El snapshot de respaldo lee jornadas, configuración y módulo privado en una única transacción. Los JSON mantienen `format: "mi-control-laboral"` y `version: 1`; añaden el campo opcional `privateGuards`. No contienen `BigInt`, handles ni credenciales. La exportación JSON manual y las copias automáticas verificadas incluyen ambos módulos; el fingerprint también considera los cambios privados. Una eliminación explícita de la última guardia conserva auditoría y permite respaldar ese estado sin sobrescribir archivos anteriores. La pausa protectora tras limpiar jornadas laborales se mantiene.

**Importación segura:**

1. Un JSON antiguo sin `privateGuards` conserva íntegramente el módulo privado local, incluso al restaurar configuración laboral.
2. La casilla **Incluir Guardias privadas compatibles (agrega sin sobrescribir)** permite incluir o excluir expresamente el módulo privado. Desmarcarla importa únicamente el contenido laboral.
3. En un dispositivo sin módulo privado configurado ni historial, restaura guardias y configuraciones del archivo. Si ya existen datos privados, conserva la configuración y los registros locales, agrega guardias nuevas y omite las coincidentes por ID o fechas exactas. No sobrescribe horas, tarifas ni auditorías locales.
4. Si las liquidaciones o ventanas del respaldo se superponen de forma incompatible con las locales, **rechaza toda la importación de forma atómica**: tampoco importa parcialmente jornadas laborales. Se puede conservar el respaldo y desmarcar la casilla para importar solo el control laboral. No se fusionan silenciosamente calendarios incompatibles.
5. Valida el archivo completo antes de escribir. Al cambiar de origen/dispositivo, usa una versión de la app que admita este módulo para conservarlo en futuras exportaciones.

La limpieza **Borrar todos los registros** existente afecta solo jornadas DGVS/HGI e historiales laborales; conserva Guardias privadas y lo indica antes de confirmar. Para eliminar una guardia privada se usa su botón individual. Nunca se elimina la base completa ni se envían datos a un servidor.

## Verificación

Ejecutar con Node.js 22 o posterior:

```sh
node --test tests/*.test.mjs
```

Con el servidor local activo y Playwright/Chromium como herramientas de desarrollo:

```sh
TEST_URL=http://localhost:8000/ node tests/private-guards.cjs
TEST_URL=http://localhost:8000/ node tests/browser.cjs
TEST_URL=http://localhost:8000/ node tests/data-controls.cjs
TEST_URL=http://localhost:8000/ node tests/margins.cjs
TEST_URL=http://localhost:8000/ node tests/mandatory-attendance.cjs
TEST_URL=http://localhost:8000/ node tests/automatic-incidents.cjs
TEST_URL=http://localhost:8000/ node tests/mobile-v11.cjs
UPGRADE_BASE=82cd538 UPGRADE_VERSION=V2.0 node tests/upgrade-v11.cjs
node tests/upgrade.cjs
```

Los tests solo usan datos sintéticos y contextos temporales. `private-guards.test.mjs` cubre cambios sábado/lunes, medianoche, varios días/meses, cierre y tarifa simultáneos, distribución del ejemplo, proporcionalidad/redondeo, edición de vecinos, patrones y factura futuros/individuales, tarifas históricas y recálculo, eliminación, duplicados, días 31 e importación conflictiva. `backup-manager.test.mjs` añade verificación de JSON privado, cambios y copias históricas aun sin jornadas laborales.

La prueba `private-guards.cjs` recorre la interfaz en Android emulado, dos liquidaciones con un único ID, edición y recálculo confirmado, fechas de liquidación/factura, cancelaciones, duplicados, exportación, restauración en otro contexto, JSON antiguo, exclusión privada, rollback atómico, concurrencia, persistencia/offline, tema claro, ancho 320 y conservación exacta de jornadas/configuración/auditoría. También comprueba que limpiar jornadas laborales no borra guardias.

**Resultados ejecutados:** 72 pruebas automatizadas de Node aprobadas; siete flujos de navegador aprobados (Guardias privadas, uso general, datos/respaldos, márgenes, asistencia, incidencias automáticas y calendario/móvil); actualización real desde `main` (`82cd538`) y desde la PWA inicial aprobadas, con conservación de datos y recarga offline. La interfaz también verificó el cambio de patrón y factura futuros sin conexión.

El Service Worker **v3.0.0** precachea ambos módulos nuevos y mantiene juntas las versiones de HTML/CSS/JS. Usa rutas relativas compatibles con `/mi-control-laboral/`. La actualización no fuerza recarga de formularios abiertos; cerrar todas las ventanas y volver a abrir activa la versión nueva. No se modifican GitHub Pages ni su publicación.

### Límites

- Pendiente validación manual de instalación, controles de fecha y acceso a carpetas en un **Android físico**. El soporte de File System Access sigue dependiendo del navegador; se conserva exportación JSON manual.
- Se facturan minutos de reloj civil de Paraguay, no una conversión de duración UTC. No se interpretan ambigüedades de antiguos cambios de horario estacional al cargar fechas históricas.
- Los importes son estimaciones brutas. No incluye impuestos, retenciones, cobros ni facturación electrónica.
- El módulo se guarda localmente: exportar respaldos sigue siendo necesario ante pérdida/borrado de almacenamiento del navegador.
