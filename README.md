# mi-control-laboral
PWA personal para registro y control de asistencia laboral


---

# Mi Control Laboral

Base de una PWA personal para controlar entradas, salidas y horas laborales desde el celular. **Etapa 1: únicamente bienvenida y bases técnicas.** No hay registro de horarios, cálculos ni reportes. La experiencia de «Mi Gimnasio» es una referencia conceptual; no se ha reutilizado código ni un diseño no proporcionado.

## Tecnologías

HTML5, CSS3, JavaScript con módulos ES, Web App Manifest y Service Worker. Sin frameworks, paquetes de ejecución, fuentes remotas, analítica ni servicios externos. IndexedDB queda reservado para una etapa posterior; todavía no se crea una base de datos ni se solicitan permisos del dispositivo.

## Estructura

```text
index.html                 Bienvenida adaptable, modo oscuro
css/styles.css             Diseño móvil y escritorio
js/app.js                  Entrada y registro del Service Worker
js/modules/                Reserva documentada para futuros módulos
js/storage/                Reserva documentada para IndexedDB y respaldos
assets/icons/              Iconos PNG y fuente SVG
manifest.webmanifest       Identidad, alcance e instalación
sw.js                      Caché del shell y navegación sin conexión
.nojekyll                  Sitio estático compatible con GitHub Pages
README.md                  Operación y publicación
docs/VALIDACION.md         Comprobaciones de esta entrega
```

## Ejecutar localmente

Con Python 3, desde la carpeta del repositorio:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abrir `http://localhost:8000/`. No abrir `index.html` como archivo: módulos y Service Worker necesitan HTTP en localhost o HTTPS. No hace falta compilar ni instalar dependencias. Para probar la subruta de Pages, ejecutar el servidor desde la carpeta padre y abrir `http://localhost:8000/mi-control-laboral/`.

## Publicar después en GitHub Pages

**Pages no está activado en esta etapa.** Cuando decidas publicar:

1. En Settings → Pages, elegir **Deploy from a branch**.
2. Seleccionar `main` y `/(root)`, guardar y esperar el despliegue.
3. Abrir `https://TU_USUARIO.github.io/mi-control-laboral/`.

Todas las rutas de archivos, manifest, alcance y Service Worker son relativas. `.nojekyll` evita procesamiento de Jekyll. No se necesita un workflow ni un servicio de pago.

GitHub Pages desde repositorios privados requiere un plan compatible (por ejemplo, GitHub Pro para cuentas personales). Si tu plan no lo incluye, conservar el repositorio privado y el uso local; valorar después otra publicación o un cambio explícito de visibilidad. No se ha contratado ningún servicio. Un repositorio privado no garantiza que un sitio Pages publicado sea privado.

## Instalar en Android

Después de publicar en HTTPS, abrir la URL en Chrome para Android, esperar la primera carga y usar el menú **Instalar aplicación** o **Añadir a pantalla de inicio** (el texto depende del navegador). Aceptar y abrir el icono instalado. El manifest incluye iconos de 192 y 512 px y uno maskable con margen seguro. No se fuerza una ventana de instalación ni se solicitan permisos.

La primera visita necesita conexión; después de que el Service Worker se active y termine de almacenar el shell, la bienvenida funciona sin conexión. En escritorio puede usarse normalmente y, en navegadores compatibles, instalarse desde la barra de direcciones. El acceso desde el celular a una IP local por HTTP no habilita normalmente el Service Worker; para instalar, usar HTTPS.

## Actualizar desde GitHub

1. Modificar los archivos y aumentar `VERSION` en `sw.js` cuando cambie el shell. Agregar a `SHELL` los nuevos recursos esenciales.
2. Probar con conexión y sin conexión, incluyendo la subruta del repositorio.
3. Ejecutar `git add .`, `git commit -m "Describir el cambio"` y `git push origin main`.
4. Una vez habilitado Pages, esperar su despliegue. Abrir la app con conexión para que el navegador detecte el nuevo Service Worker. Cerrar todas sus ventanas/pestañas y volver a abrir para activar la versión pendiente. No se fuerza una recarga que pueda interrumpir futuras operaciones.

La caché es exclusiva de esta ruta y solo contiene archivos estáticos. Se conserva la versión anterior hasta completar la instalación de la nueva. No se eliminan cachés de otras aplicaciones del mismo dominio.

## Próxima etapa

Acordar primero reglas de jornada, datos necesarios, privacidad, persistencia, exportación y respaldo. Solo entonces definir el esquema IndexedDB y los módulos funcionales. No introducir datos laborales reales ni credenciales en Git.
