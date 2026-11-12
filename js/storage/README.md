# Persistencia local v1

`db.js` centraliza IndexedDB (`mi-control-laboral`, versión 1). `records` usa `AAAA-MM-DD|vínculo` como clave única y `settings` conserva la configuración.

Las escrituras de jornadas guardan auditoría y verifican la revisión anterior dentro de la misma transacción. La importación JSON valida todo antes de escribir, agrega solamente claves inexistentes y restaura opcionalmente la configuración en esa misma transacción. Los duplicados existentes nunca se sobrescriben.

Los datos personales no se guardan en el Service Worker ni se transmiten. El almacenamiento del navegador puede borrarse: usar las exportaciones JSON como copias de respaldo.
