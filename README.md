# mi-control-laboral
PWA personal para registro y control de asistencia laboral

## Mi Control Laboral 2.0

Aplicación personal de asistencia con interfaz corporativa minimalista. HTML, CSS y módulos JavaScript, sin dependencias de ejecución ni servicios externos. Los registros se guardan solo en el navegador y **no sustituyen el reloj biométrico oficial**.

### Uso diario

- **Inicio:** fecha, vínculo automático del día, horario previsto, reloj local con segundos y botones de entrada/salida. Cada marcación guardada se muestra y su botón queda deshabilitado para evitar repeticiones accidentales. Elegir otro vínculo permite una jornada excepcional, previa confirmación.
- **Corregir o ingresar horario:** abre un editor breve con fecha, vínculo y dos horas. «Justificar / excepción» agrupa justificaciones independientes, permiso, vacaciones, reposo, feriados, cambio de guardia y clasificación de posibles ausencias. Ya no se muestran confirmaciones oficiales ni cierre de jornada. Los campos y notas históricos se conservan internamente. Guardar solo una corrección de hora conserva todos los demás campos existentes.
- **Este período:** tardanzas, salidas anticipadas y omisiones del vínculo elegido; alerta únicamente cuando corresponda.
- **Registros recientes:** hasta cinco jornadas del vínculo seleccionado, ordenadas de más reciente a más antigua. Pulsar una para corregirla. Sin vínculo seleccionado se muestran las últimas cinco de todos.
- **Calendario:** mes y vínculo seleccionables, solo jornadas programadas o realmente guardadas. Tarjetas breves con horas/estado y Editar. «Registrar jornada excepcional» no altera el horario semanal. Permisos, feriados y situaciones especiales se conservan.
- **Resumen:** período 16–15 y filtro por vínculo. Tardanzas, salidas anticipadas, omisiones, posibles ausencias, saldo de la omisión permitida, «Sin sanciones estimadas» o detalle de las sanciones posibles. «Ver fechas de incidencia» permite consultar y editar las jornadas contadas. No repite estimaciones de cero ni estadísticas secundarias.

La navegación inferior tiene solo Inicio, Calendario y Resumen. El icono de engranaje abre Configuración (horarios, tolerancias, feriados, reglas y respaldos). El icono de apariencia alterna modo oscuro/claro; su preferencia se conserva por origen en `localStorage`, separada de los datos laborales y del respaldo JSON.

### Hora y zona horaria

Se utiliza la **hora local del dispositivo**, tanto para el reloj como para fecha, período y marcaciones. La zona prevista es `America/Asuncion`; si el dispositivo tiene otra zona, Inicio muestra ambas para que puedas revisarlo. No se convierten ni modifican horarios históricos. El reloj se actualiza cada segundo; los registros mantienen la precisión existente de minutos (`HH:mm`). El vínculo y período actuales cambian al pasar de día, sin interrumpir un formulario abierto.

### Reglas conservadas

- V1 DGVS: miércoles 07:30–19:30; V2 DGVS: jueves 07:30–19:30; V3 HGI: domingo 07:00–19:00. Configuración y contadores independientes.
- Período del 16 al 15 inclusive. El cambio de período no elimina datos.
- Tolerancia normal: 15 minutos inclusive. Lluvia: 60 minutos **totales** inclusive, activados por jornada. 07:45/08:30 son válidas; 07:46/08:31 corresponden a tardanza, respectivamente.
- Las tardanzas fuera de tolerancia y salidas anticipadas se cuentan automáticamente salvo justificación, sin confirmación individual ni cierre. El retraso se informa desde el horario previsto, sin compensar con horas posteriores.
- Después de superar estrictamente la hora de salida, entrada sin salida o salida sin entrada genera una omisión automáticamente. Una omisión permitida por vínculo y período. No se usan los estados administrativos antiguos para estos cálculos nuevos.
- Ninguna marcación después de terminar la jornada produce «Posible ausencia», nunca dos omisiones ni una ausencia injustificada definitiva automáticamente. Se puede clasificar como permiso, vacaciones, reposo, otra excepción, ausencia injustificada o doble omisión. La doble omisión requiere una elección explícita; las justificaciones excluyen solo su incidencia correspondiente.
- Omisiones: 0–1 → 0 días; 2 → 1; 3 → 2; 4 → 3; 5 → 4; más de 5 → revisión normativa.
- Tardanzas y salidas anticipadas, **por separado**: 0–2 → 0 días; 3 → 1; 4 → 2; 5 → 3; 6 → 4; 7 o más → 5 días de salario.
- Las escalas son **configuración informativa pendiente de verificación institucional**, no decisiones disciplinarias oficiales.
- Situaciones: feriado libre/trabajado, permiso, vacaciones, reposo médico, ausencia justificada/injustificada, cambio de guardia y doble omisión explícita. Los antiguos registros «pendiente de revisión» se admiten sin exigir ese estado en el editor. Los feriados se introducen en Configuración: libres por defecto, con excepción editable por fecha/vínculo.
- Las fechas futuras no generan faltas. El inicio del seguimiento limita la revisión de jornadas transcurridas sin registros; no crea faltas retroactivas ni impide cargar registros históricos.

La leyenda del calendario conserva la distinción entre completa/validada, pendiente, incidencia confirmada, programada sin registro y situación especial. Los números pequeños identifican el vínculo sin llenar la celda de etiquetas. Los cálculos de dominio conservan minutos enteros y horarios guardados por jornada; la interfaz principal se limita a los datos necesarios de asistencia.

### Datos, compatibilidad y respaldos

La corrección de incidencias conserva horarios, tolerancias y escalas normativas. La mejora de Datos y respaldos añade metadatos transaccionales en `settings` y una limpieza selectiva en `js/storage/db.js`. No cambia el nombre `mi-control-laboral`, IndexedDB versión 1, sus almacenes (`records`, `settings`), sus claves ni el origen de la aplicación. No hay migraciones de estructura, reinicios ni reescrituras automáticas de registros. El borrado de jornadas solo se ejecuta por decisión explícita del usuario tras doble confirmación. Las justificaciones heredadas se interpretan al leer: `justified` conserva la justificación; `pending` y `unjustified` cuentan si se detecta incidencia. Los valores originales y su auditoría permanecen intactos; una edición explícita guarda las casillas usando los campos anteriores. Las jornadas parciales muestran su hora faltante y, una vez superada la salida, su omisión automática. Las jornadas sin marcas muestran «Posible ausencia» tras la salida; no se declaran injustificadas automáticamente. La omisión justificada se conserva como detección sin sumar a la escala. Las correcciones explícitas continúan dejando auditoría anterior/posterior y control de revisión entre pestañas.

En Configuración:

- Exportar **JSON** conserva datos, configuración e historial. Los JSON anteriores siguen usando el mismo `format` y `version: 1` y se pueden importar.
- Importar valida el archivo completo, agrega solo jornadas inexistentes y conserva los duplicados. Restaurar también la configuración es opcional y transaccional.
- Exportar **CSV** sirve para consulta; no sustituye el JSON para restaurar.

Exporta regularmente: el navegador puede borrar su almacenamiento. No subas respaldos personales a GitHub. Localhost y Pages son orígenes distintos y no comparten IndexedDB: usa JSON para transferir entre ellos. No se añaden permisos del dispositivo, analítica ni transmisión de registros.

### Estructura

```text
index.html                    Cabecera, tres pestañas y diálogo
css/styles.css                Paletas claro/oscuro y diseño móvil
js/app.js                     Interfaz, marcación, edición, exportación y arranque
js/modules/domain.js          Reglas, estadísticas y validaciones conservadas
js/modules/presentation.js    Reloj local, vínculo automático y preferencia visual
js/storage/db.js              IndexedDB e importación conservados
manifest.webmanifest          Instalación PWA
sw.js                         Caché v2.2.0, solo recursos estáticos
assets/icons/                 Iconos existentes
tests/                        Reglas, interfaz, móvil y actualización
tests/automatic-incidents.*   Ejemplo de 120 min, justificaciones y compatibilidad
docs/VALIDACION-V2.md          Verificación de esta entrega
```

### Ejecutar y probar

Desde el repositorio, con Python 3:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abrir `http://localhost:8000/`, sin compilación ni instalación de dependencias. Para simular Pages, servir la carpeta padre y abrir `/mi-control-laboral/`. No abrir el HTML como archivo.

Reglas y presentación (Node.js 22 o posterior):

```sh
node --test tests/*.test.mjs
```

Pruebas de navegador con Playwright/Chromium como herramientas de desarrollo, no dependencias de la PWA (por ejemplo, `npm install --no-save --package-lock=false playwright`). `CHROMIUM_PATH` permite cambiar `/usr/bin/chromium`. Con el servidor activo:

```sh
TEST_URL=http://localhost:8000/ node tests/browser.cjs
TEST_URL=http://localhost:8000/ node tests/mandatory-attendance.cjs
TEST_URL=http://localhost:8000/ node tests/data-controls.cjs
TEST_URL=http://localhost:8000/ node tests/automatic-incidents.cjs
TEST_URL=http://localhost:8000/ node tests/mobile-v11.cjs
```

El segundo conserva el nombre histórico, pero verifica las regresiones de Calendario/Resumen en la interfaz actual. Los tests usan perfiles y datos sintéticos temporales, separados de tu navegador personal.

Actualización real en el mismo origen (servidor temporal propio, requiere historial Git):

```sh
node tests/upgrade-v11.cjs
UPGRADE_BASE=36fa1a4 UPGRADE_VERSION=V1.1 node tests/upgrade-v11.cjs
UPGRADE_BASE=2cc02dc UPGRADE_VERSION=V2.0 node tests/upgrade-v11.cjs
node tests/upgrade.cjs
```

Verifican respectivamente v1.0 → actual, v1.1 → actual, v2.0 → actual y etapa inicial → actual. Comparan los datos, configuración e historial existentes, compatibilidad JSON y uso offline.

### Instalación y actualización

La configuración de GitHub Pages no se modifica en esta entrega. Las rutas permanecen relativas, con `.nojekyll` y URL de proyecto `https://dannpyo.github.io/mi-control-laboral/`. El PR debe revisarse antes de fusionar; su publicación posterior dependerá de la configuración existente del repositorio.

Para instalar en Android, abrir la URL HTTPS en Chrome y elegir «Instalar aplicación» o «Añadir a pantalla de inicio». La primera carga necesita conexión; tras activar el Service Worker, la app y la edición funcionan offline. En escritorio puede usarse o instalarse desde un navegador compatible.

Al actualizar, abrir con conexión para descargar el nuevo Service Worker, cerrar todas las pestañas/ventanas de la app y volver a abrir. No se fuerza una recarga durante una edición. La caché v2.2.0 conserva juntos HTML, CSS y módulos de la versión activa y nunca contiene registros. Cambiar `VERSION`, los recursos de `SHELL` y sus identificadores `?v=` cuando corresponda en futuras versiones.

La instalación y los flujos se prueban en Chromium y con emulación Android; queda pendiente la comprobación de la versión 2.0 en un Android físico.

La corrección puntual de incidencias automáticas y sus pruebas se detallan en `docs/INCIDENCIAS-AUTOMATICAS.md`.


### Datos y respaldos locales

En Configuración → Datos y respaldos puedes seleccionar/cambiar una carpeta, activar o desactivar las copias automáticas, crear/verificar una copia ahora y consultar su estado/fecha. Requiere File System Access API y Web Locks; **el soporte real en Android debe comprobarse en el dispositivo**. Si no está disponible, se mantiene la exportación JSON y un recordatorio cada siete días en esta sección, solo con la app abierta.

Las copias se escriben después de confirmar el guardado laboral, se verifican mediante lectura y tienen nombres únicos. Se pueden agrupar por día y omitir contenido sin cambios. No se eliminan copias históricas ni se guardan handles en el JSON. Un fallo no revierte la jornada.

«Borrar todos los registros» muestra la cantidad, ofrece respaldo previo y exige dos confirmaciones, la segunda escribiendo `BORRAR`. Limpia únicamente jornadas e historiales y conserva configuración, feriados, tema y ajustes de respaldo. Las copias existentes quedan intactas y el automático queda en pausa hasta que se elija Crear respaldo ahora. Una copia del estado vacío requiere decisión explícita; no se genera automáticamente.

Detalles de compatibilidad, integridad, conservación, pruebas y limitaciones: [Datos y respaldos](docs/DATOS-Y-RESPALDOS.md).


### Asistencia obligatoria simplificada

La programación se calcula al consultar, sin insertar jornadas vacías en IndexedDB ni en respaldos. Las fechas sin registros se evalúan desde el inicio de seguimiento conservado; los registros históricos ya guardados se recalculan en su propio período incluso antes de ese inicio. Las excepciones eximentes evitan posibles ausencias y omisiones. El reloj actualiza las incidencias al superar la salida sin interrumpir el editor.

El recálculo no altera horas, auditorías ni justificaciones antiguas. Los JSON siguen usando versión 1; `omissionJustified` es opcional y la doble omisión explícita es una nueva situación reconocida por esta versión. Las confirmaciones de doble omisión ya guardadas se respetan como clasificación histórica; no se exigen para las nuevas jornadas.

Resultados, criterios y ejemplos: [Asistencia obligatoria](docs/ASISTENCIA-OBLIGATORIA.md).
