# mi-control-laboral
PWA personal para registro y control de asistencia laboral

---

## Mi Control Laboral · versión 1.1

PWA personal, local y sin dependencias de ejecución: HTML5, CSS3, módulos JavaScript, IndexedDB, manifest e instalación offline. El registro en esta aplicación **no sustituye ni modifica el reloj biométrico oficial**. No se envían datos a servicios externos.

### Funciones

- **Inicio:** jornada actual, próxima jornada y marcación personal con fecha/hora local del celular.
- **Calendario:** mes y vínculo seleccionables; solo muestra vínculos programados o realmente guardados en la fecha. La opción secundaria «Registrar jornada excepcional» permite otros vínculos, sin cambiar la programación semanal. Indicadores separados V1/V2/V3 cuando coinciden.
- **Resumen:** selector del período administrativo con anterior/siguiente y filtro de vínculo. Tres tarjetas compactas (o solo la seleccionada) con contadores, saldo de omisión disponible y alertas preventivas/sancionables; las estadísticas completas y estimaciones se despliegan bajo demanda.
- **Historial:** orden descendente por fecha, filtros por vínculo y período, edición, observaciones y auditoría con valores anteriores y posteriores.
- **Configuración:** horarios, tolerancias, fecha de inicio del seguimiento, feriados, consulta de reglas, exportación JSON/CSV e importación JSON.

Vínculos iniciales: miércoles 07:30–19:30, jueves 07:30–19:30 y domingo 07:00–19:00. Cada registro conserva una copia de su horario y tolerancias, por lo que cambiar la configuración no altera registros anteriores. Se admiten jornadas dentro del mismo día. Para una guardia excepcional, ajustar su horario en el editor; marcar «Cambio de guardia» en la jornada sustituida y registrar la jornada efectivamente trabajada en su fecha como habitual o feriado trabajado.

### Reglas implementadas

- Períodos del **16 al 15 inclusive**, calculados por fecha local. El día 16 cambia el período actual sin eliminar datos. Resumen e historial permiten consultar cualquier período anterior.
- Tolerancia normal de 15 minutos inclusive; por lluvia, **60 minutos totales**, al activar la condición en esa jornada. 07:45 es válida y 07:46 es tardanza; con lluvia, 08:30 es válida y 08:31 es tardanza para inicio 07:30.
- Salida válida a la hora prevista o después. La tardanza no se compensa con una salida posterior. Tardanzas y salidas anticipadas se clasifican como justificadas, injustificadas o pendientes. **Solo las injustificadas suman sus respectivos contadores.**
- Los tiempos se calculan con minutos enteros y se muestran como `12 h 00 min`, sin deducciones de descansos no especificados. Se separan horas programadas y personales. La diferencia se calcula solo entre horas personales completas y el horario previsto de esas mismas jornadas, incluidas las excepcionales, no contra toda la programación futura. Esa diferencia no equivale a una incidencia sancionable. No se infieren horas oficiales del reloj.
- Cada omisión es una entrada o salida **oficial confirmada como omitida**, no una casilla personal vacía. Cuenta al cerrar/revisar la jornada y una vez transcurrida su hora prevista de salida. Una jornada con ambas omisiones puede sumar dos. Una jornada sin marcaciones nunca se convierte automáticamente en ausencia injustificada.
- Una omisión permitida por vínculo y período. Escala de omisiones: 0–1 → 0 días de salario; 2 → 1; 3 → 2; 4 → 3; 5 → 4; más de 5 → revisión normativa.
- Escala independiente de tardanzas y salidas anticipadas: 0–2 → 0 días; 3 → 1; 4 → 2; 5 → 3; 6 → 4; 7 o más → 5 días. **Son estimaciones informativas, no decisiones disciplinarias oficiales.** No se suman las escalas entre sí ni se inventan multas para ausencias.
- Situaciones: jornada habitual, feriado libre, feriado trabajado, permiso, vacaciones, reposo médico, ausencia justificada, ausencia injustificada, cambio de guardia y jornada pendiente de revisión. Las situaciones exentas o en revisión no suman las incidencias anteriores; feriado trabajado usa las reglas de una jornada normal.
- Las fechas futuras no suman horas ni incidencias. Las jornadas programadas transcurridas sin registro, desde el inicio del seguimiento, se muestran para revisar, sin atribuirles faltas u omisiones. Ese inicio es hoy al primer uso y se puede ajustar para cargar períodos anteriores.
- No se descarga un calendario de feriados: introducir las fechas oficiales en Configuración. Son libres por defecto para todos los vínculos. Cualquier registro ya guardado en esa fecha es una excepción explícita y se conserva; se puede cambiar a feriado libre/trabajado por fecha y vínculo en Calendario.

### Calendario y estadísticas de v1.1

La leyenda aplica por vínculo: verde exige entrada/salida personales, cierre, estados oficiales marcados y justificaciones resueltas; ámbar indica completar/revisar; rojo identifica tardanza/salida injustificada o ausencia injustificada explícita; gris/borde indica programación sin registro; azul representa feriado libre, permiso, vacaciones u otra situación especial. Una omisión oficial confirmada sin justificación de incidencia no se presume injustificada: se revisa y se contabiliza según su regla. No hay indicador laboral en días sin programación ni excepción. Los feriados de fechas sin vínculo programado permanecen visibles al seleccionar la fecha.

Las estadísticas distinguen programación, jornadas completas con ambas horas, marcaciones incompletas, cierre explícito, validación completa, excepciones y jornadas transcurridas sin registro. Los vacíos ya guardados en v1.0 se conservan y no se cuentan como trabajados. Un registro «pendiente de revisión» tampoco se presume trabajado.

La programación cuenta las fechas semanales del período completo, incluidas futuras, excluyendo feriados libres y situaciones exentas. Se calcula con la configuración semanal actual y usa horarios guardados cuando existen. El inicio de seguimiento **solo limita las fechas sin registro que se señalan para revisar**: no crea faltas ni oculta el calendario anterior. Un registro histórico manual se contabiliza únicamente en su período; no cambia otros períodos.

### Registrar y corregir

1. En Inicio, elegir el vínculo y marcar entrada o salida. Se usa la hora local del dispositivo, con precisión de minutos. La aplicación no registra automáticamente en el biométrico.
2. Abrir «Ver / editar jornada» para añadir lluvia, observaciones, justificación y estados de marcación oficial. «Ingreso manual» permite otras fechas.
3. Confirmar las marcaciones oficiales y cerrar la jornada cuando corresponda. La justificación de una incidencia nueva queda pendiente hasta que se indique su estado.
4. Guardar. Cada cambio conserva fecha, acción y valores anteriores/posteriores en el historial local. Cambiar fecha/vínculo en el editor abre otra jornada; no traslada ni elimina la anterior. Guardar antes las modificaciones que quieras conservar.

No hay borrado automático ni botón de borrado de jornadas. Para rectificar, editar el registro; el cambio queda auditado. Este historial local es trazabilidad personal, no un registro oficial inviolable.

### Almacenamiento y respaldos

Actualización v1.1 sin migraciones, borrados ni reescritura automática de registros. Los respaldos JSON v1.0 siguen siendo compatibles y mantienen el mismo formato `version: 1`. IndexedDB `mi-control-laboral`, versión 1, con almacenes `records` y `settings`. Identidad única por fecha y vínculo; las marcaciones rápidas repetidas se rechazan. Las ediciones comprueban la revisión para impedir que una pestaña desactualizada sobrescriba cambios de otra.

- **JSON:** respaldo versionado con configuración, horarios, observaciones e historial completo. Exportar regularmente: el navegador puede eliminar el almacenamiento local.
- **CSV:** tabla de consulta de jornadas; no sirve para restaurar el historial. Los campos se escapan y se protegen contra fórmulas de hoja de cálculo.
- **Importación JSON:** valida completamente el archivo antes de escribir, acepta hasta 20 MB y rechaza duplicados internos. Agrega solo jornadas inexistentes, conserva las coincidentes e informa cantidades. Añade una entrada de auditoría de importación.
- La configuración actual se conserva por defecto. Para recuperarla en otro celular, activar «Restaurar también la configuración del respaldo». La restauración elegida y la incorporación de jornadas se realizan en una única transacción.

No se solicitan ubicación, cámara, notificaciones ni otros permisos del dispositivo. No hay credenciales ni datos reales incluidos en el repositorio.

### Estructura

```text
index.html                 Estructura y navegación inferior
css/styles.css             Diseño oscuro adaptable
js/app.js                  Interfaz, eventos, exportaciones y arranque
js/modules/domain.js       Fechas, reglas, validaciones y estadísticas
js/storage/db.js           IndexedDB, concurrencia e importación transaccional
assets/icons/              Iconos PNG y fuente SVG existentes
manifest.webmanifest       Identidad, alcance e instalación
sw.js                      Caché exclusivamente del shell estático
.nojekyll                  Compatibilidad con GitHub Pages
tests/domain.test.mjs      Pruebas de reglas y fechas (Node, sin paquetes)
tests/browser.cjs          Pruebas de interfaz, IndexedDB, instalación y offline
tests/upgrade.cjs          Transición desde la PWA de etapa 1
tests/corrections.test.mjs Calendario, métricas y tiempos v1.1
tests/mobile-v11.cjs       Correcciones en vistas móviles
tests/upgrade-v11.cjs      Preservación de datos y JSON desde v1.0
docs/VALIDACION-V1.md       Verificación histórica de v1.0
docs/VALIDACION-V11.md      Verificación de correcciones v1.1
```

### Ejecutar localmente

Desde el repositorio, con Python 3:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abrir `http://localhost:8000/`. No abrir el HTML como archivo. No se necesita compilar ni instalar paquetes para usar la aplicación. Para probar la subruta de Pages, servir la carpeta padre y abrir `/mi-control-laboral/`.

### Pruebas

Reglas, con Node.js 22 o posterior:

```sh
node --test tests/*.test.mjs
```

Para las pruebas de navegador, disponer de Playwright y Chromium como herramientas de desarrollo (no son dependencias de la PWA). Por ejemplo, `npm install --no-save --package-lock=false playwright`. El script usa `/usr/bin/chromium` por defecto, configurable con `CHROMIUM_PATH`.

Con el servidor anterior activo:

```sh
TEST_URL=http://localhost:8000/ node tests/browser.cjs
TEST_URL=http://localhost:8000/ node tests/mobile-v11.cjs
```

Para verificar además la actualización desde la etapa inicial, ejecutar `node tests/upgrade.cjs` (requiere disponer del commit `8c84ab3` en el historial Git). Ese script levanta su propio servidor temporal y comprueba la transición de la caché anterior a v1.1.0.

La conservación exacta de IndexedDB y la compatibilidad de JSON se verifican con `node tests/upgrade-v11.cjs` (requiere el commit v1.0 `e3e558e` en el historial). Este test crea datos sintéticos en v1.0, cambia a v1.1 en el mismo origen y compara todos los registros, su historial y la configuración sin modificarlos.

El script de navegador crea perfiles y datos sintéticos temporales; no usa datos reales ni modifica los registros del navegador personal. Para replicar el escenario de Pages, servir la carpeta padre y usar `TEST_URL=http://localhost:8000/mi-control-laboral/`.

### Publicar después en GitHub Pages

Esta corrección no cambia la configuración existente de GitHub Pages ni despliega desde la rama de trabajo. La URL de proyecto es `https://dannpyo.github.io/mi-control-laboral/`. Las rutas del manifest, archivos y Service Worker siguen siendo relativas y no se requiere compilación. La publicación al fusionar depende de la configuración de Pages del repositorio.

Los datos de asistencia permanecen en IndexedDB del navegador, no en el repositorio ni en Pages. No subir respaldos personales al repositorio. La visibilidad y el hosting no se modifican en esta corrección.

### Instalar en Android y escritorio

Tras publicar en HTTPS, abrir la URL en Chrome para Android, esperar la primera carga y elegir «Instalar aplicación» o «Añadir a pantalla de inicio». También se puede usar normalmente desde escritorio o instalar desde un navegador compatible. El acceso a una IP local por HTTP no habilita normalmente el Service Worker: usar localhost para pruebas o HTTPS para el celular.

La primera visita necesita conexión. Tras activarse el Service Worker y almacenarse el shell, la interfaz, IndexedDB y la edición funcionan offline. Los datos se mantienen por navegador y origen: localhost y el futuro sitio Pages no comparten datos; transferirlos mediante JSON.

### Actualizar desde GitHub

Trabajar en una rama, probar, subir un commit y abrir un PR hacia `main`. Al cambiar recursos esenciales, aumentar `VERSION` en `sw.js` y actualizar `SHELL` si se añaden archivos. Los identificadores `?v=1.1.0` del CSS y punto de entrada en `index.html` deben coincidir con los recursos de `SHELL`. Estos identificadores permiten la transición desde la caché de la etapa inicial. La navegación conserva el HTML del shell activo para evitar mezclar versiones. Una vez habilitado Pages, la fusión en `main` publicará los cambios.

La app detecta la nueva versión al abrir con conexión. Cerrar todas sus ventanas/pestañas y volver a abrir para activar el Service Worker pendiente; no se fuerza una recarga durante una edición. Las cachés son exclusivas de la ruta de esta app y contienen solo archivos estáticos, nunca registros ni respaldos. Las actualizaciones conservan IndexedDB.

### Verificación pendiente en dispositivos

La instalación en un Android físico y el despliegue real en Pages requieren probarse después de autorizar la publicación. La lógica, la persistencia al reiniciar Chromium y el funcionamiento offline se prueban localmente sin activar hosting.
