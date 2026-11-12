# Almacenamiento futuro

Este directorio alojará el adaptador de IndexedDB. En esta etapa no se abre ninguna base ni se define un esquema laboral.

Al definir los requisitos: centralizar aquí apertura, migraciones versionadas y transacciones; los módulos de interfaz no accederán directamente a IndexedDB. Diseñar exportación e importación con validación de formato y versión, y respaldo descargable mediante acción explícita del usuario. No almacenar información personal en la caché del Service Worker. El almacenamiento del navegador puede borrarse y no equivale a una copia de seguridad.
