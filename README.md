# mi-control-laboral
PWA personal para registro y control de asistencia laboral

---

## Mi Control Laboral · versión 1.0

PWA personal, local y sin dependencias de ejecución: HTML5, CSS3, módulos JavaScript, IndexedDB, manifest e instalación offline. El registro en esta aplicación **no sustituye ni modifica el reloj biométrico oficial**. No se envían datos a servicios externos.

### Funciones

- **Inicio:** jornada actual, próxima jornada y marcación personal con fecha/hora local del celular.
- **Calendario:** mes seleccionable, indicadores y edición de cualquier fecha y vínculo.
- **Resumen:** período administrativo, horas personales, pendientes, jornadas sin registro y contadores independientes por vínculo y tipo de incidencia; alertas desde la segunda incidencia.
- **Historial:** orden descendente por fecha, filtros por vínculo y período, edición, observaciones y auditoría con valores anteriores y posteriores.
- **Configuración:** horarios, tolerancias, fecha de inicio del seguimiento, feriados, consulta de reglas, exportación JSON/CSV e importación JSON.

Vínculos iniciales: miércoles 07:30–19:30, jueves 07:30–19:30 y domingo 07:00–19:00. Cada registro conserva una copia de su horario y tolerancias, por lo que cambiar la configuración no altera registros anteriores. Se admiten jornadas dentro del mismo día. Para una guardia excepcional, ajustar su horario en el editor; marcar «Cambio de guardia» en la jornada sustituida y registrar la jornada efectivamente trabajada en su fecha como habitual o feriado trabajado.

### Reglas implementadas

- Períodos del **16 al 15 inclusive**, calculados por fecha local. El día 16 cambia el período actual sin eliminar datos. Resumen e historial permiten consultar cualquier período anterior.
- Tolerancia normal de 15 minutos inclusive; por lluvia, **60 minutos totales**, al activar la condición en esa jornada. 07:45 es válida y 07:46 es tardanza; con lluvia, 08:30 es válida y 08:31 es tardanza para inicio 07:30.
- Salida válida a la hora prevista o después. La tardanza no se compensa con una salida posterior. Tardanzas y salidas anticipadas se clasifican como justificadas, injustificadas o pendientes. **Solo las injustificadas suman sus respectivos contadores.**
- Las horas son personales y se muestran en horas decimales, sin deducciones de descansos no especificados. No se infieren horas oficiales del reloj.
- Cada omisión es una entrada o salida **oficial confirmada como omitida**, no una casilla personal vacía. Cuenta al cerrar/revisar la jornada y una vez transcurrida su hora prevista de salida. Una jornada con ambas omisiones puede sumar dos. Una jornada sin marcaciones nunca se convierte automáticamente en ausencia injustificada.
- Una omisión permitida por vínculo y período. Escala de omisiones: 0–1 → 0 días de salario; 2 → 1; 3 → 2; 4 → 3; 5 → 4; más de 5 → revisión normativa.
- Escala independiente de tardanzas y salidas anticipadas: 0–2 → 0 días; 3 → 1; 4 → 2; 5 → 3; 6 → 4; 7 o más → 5 días. **Son estimaciones informativas, no decisiones disciplinarias oficiales.** No se suman las escalas entre sí ni se inventan multas para ausencias.
- Situaciones: jornada habitual, feriado libre, feriado trabajado, permiso, vacaciones, reposo médico, ausencia justificada, ausencia injustificada, cambio de guardia y jornada pendiente de revisión. Las situaciones exentas o en revisión no suman las incidencias anteriores; feriado trabajado usa las reglas de una jornada normal.
- Las fechas futuras no suman horas ni incidencias. Las jornadas programadas transcurridas sin registro, desde el inicio del seguimiento, se muestran para revisar, sin atribuirles faltas u omisiones. Ese inicio es hoy al primer uso y se puede ajustar para cargar períodos anteriores.
- No se descarga un calendario de feriados: introducir las fechas oficiales en Configuración. Son libres por defecto para todos los vínculos. Cualquier registro ya guardado en esa fecha es una excepción explícita y se conserva; se puede cambiar a feriado libre/trabajado por fecha y vínculo en Calendario.

### Registrar y corregir

1. En Inicio, elegir el vínculo y marcar entrada o salida. Se usa la hora local del dispositivo, con precisión de minutos. La aplicación no registra automáticamente en el biométrico.
2. Abrir «Ver / editar jornada» para añadir lluvia, observaciones, justificación y estados de marcación oficial. «Ingreso manual» permite otras fechas.
3. Confirmar las marcaciones oficiales y cerrar la jornada cuando corresponda. La justificación de una incidencia nueva queda pendiente hasta que se indique su estado.
4. Guardar. Cada cambio conserva fecha, acción y valores anteriores/posteriores en el historial local. Cambiar fecha/vínculo en el editor abre otra jornada; no traslada ni elimina la anterior. Guardar antes las modificaciones que quieras conservar.

No hay borrado automático ni botón de borrado de jornadas. Para rectificar, editar el registro; el cambio queda auditado. Este historial local es trazabilidad personal, no un registro oficial inviolable.

### Almacenamiento y respaldos

IndexedDB `mi-control-laboral`, versión 1, con almacenes `records` y `settings`. Identidad única por fecha y vínculo; las marcaciones rápidas repetidas se rechazan. Las ediciones comprueban la revisión para impedir que una pestaña desactualizada sobrescriba cambios de otra.

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
docs/VALIDACION-V1.md       Alcance y resultados de verificación
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
node --test tests/domain.test.mjs
```

Para las pruebas de navegador, disponer de Playwright y Chromium como herramientas de desarrollo (no son dependencias de la PWA). Por ejemplo, `npm install --no-save --package-lock=false playwright`. El script usa `/usr/bin/chromium` por defecto, configurable con `CHROMIUM_PATH`.

Con el servidor anterior activo:

```sh
TEST_URL=http://localhost:8000/ node tests/browser.cjs
```

Para verificar además la actualización desde la etapa inicial, ejecutar `node tests/upgrade.cjs` (requiere disponer del commit `8c84ab3` en el historial Git). Ese script levanta su propio servidor temporal y comprueba la transición de la caché anterior a v1.0.0.

El script de navegador crea perfiles y datos sintéticos temporales; no usa datos reales ni modifica los registros del navegador personal. Para replicar el escenario de Pages, servir la carpeta padre y usar `TEST_URL=http://localhost:8000/mi-control-laboral/`.

### Publicar después en GitHub Pages

**Pages permanece desactivado.** Cuando se decida publicar, en Settings → Pages elegir «Deploy from a branch», rama `main`, carpeta `/(root)`. La URL prevista es `https://dannpyo.github.io/mi-control-laboral/`. No se necesita workflow de despliegue ni compilación. Las rutas del manifest, archivos y Service Worker son relativas.

Pages desde repositorios privados requiere un plan compatible; no se ha contratado ningún servicio ni cambiado la visibilidad del repositorio. Un repositorio privado no garantiza que un sitio Pages publicado sea privado.

### Instalar en Android y escritorio

Tras publicar en HTTPS, abrir la URL en Chrome para Android, esperar la primera carga y elegir «Instalar aplicación» o «Añadir a pantalla de inicio». También se puede usar normalmente desde escritorio o instalar desde un navegador compatible. El acceso a una IP local por HTTP no habilita normalmente el Service Worker: usar localhost para pruebas o HTTPS para el celular.

La primera visita necesita conexión. Tras activarse el Service Worker y almacenarse el shell, la interfaz, IndexedDB y la edición funcionan offline. Los datos se mantienen por navegador y origen: localhost y el futuro sitio Pages no comparten datos; transferirlos mediante JSON.

### Actualizar desde GitHub

Trabajar en una rama, probar, subir un commit y abrir un PR hacia `main`. Al cambiar recursos esenciales, aumentar `VERSION` en `sw.js` y actualizar `SHELL` si se añaden archivos. Los identificadores `?v=1.0.0` del CSS y punto de entrada en `index.html` deben coincidir con los recursos de `SHELL`. Estos identificadores permiten la transición desde la caché de la etapa inicial. La navegación conserva el HTML del shell activo para evitar mezclar versiones. Una vez habilitado Pages, la fusión en `main` publicará los cambios.

La app detecta la nueva versión al abrir con conexión. Cerrar todas sus ventanas/pestañas y volver a abrir para activar el Service Worker pendiente; no se fuerza una recarga durante una edición. Las cachés son exclusivas de la ruta de esta app y contienen solo archivos estáticos, nunca registros ni respaldos. Las actualizaciones conservan IndexedDB.

### Verificación pendiente en dispositivos

La instalación en un Android físico y el despliegue real en Pages requieren probarse después de autorizar la publicación. La lógica, la persistencia al reiniciar Chromium y el funcionamiento offline se prueban localmente sin activar hosting.
