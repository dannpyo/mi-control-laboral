import { validateConfig, validateRecord } from "../modules/domain.js";
let database;
export function openDB() {
  return (database ||= new Promise((resolve, reject) => {
    const q = indexedDB.open("mi-control-laboral", 1);
    q.onupgradeneeded = () => {
      q.result.createObjectStore("records", { keyPath: "id" });
      q.result.createObjectStore("settings");
    };
    q.onsuccess = () => {
      q.result.onversionchange = () => q.result.close();
      resolve(q.result);
    };
    q.onerror = () => reject(q.error);
    q.onblocked = () =>
      reject(
        Error(
          "Cierra otras pestañas de la aplicación para actualizar la base.",
        ),
      );
  }));
}
async function transaction(stores, mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    try {
      result = operation(tx);
    } catch (e) {
      tx.abort();
      reject(e);
      return;
    }
    tx.oncomplete = () =>
      resolve(typeof result === "function" ? result() : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("Operación cancelada"));
  });
}
export const getRecords = () =>
  transaction(["records"], "readonly", (tx) => {
    const q = tx.objectStore("records").getAll();
    return () => q.result;
  });
export const getConfig = () =>
  transaction(["settings"], "readonly", (tx) => {
    const q = tx.objectStore("settings").get("config");
    return () => q.result;
  });
export async function saveConfig(config) {
  validateConfig(config);
  return transaction(["settings"], "readwrite", (tx) =>
    tx.objectStore("settings").put(config, "config"),
  );
}
export async function saveRecord(
  record,
  action = "Edición manual",
  expected = null,
) {
  validateRecord(record);
  return transaction(["records"], "readwrite", (tx) => {
    const store = tx.objectStore("records");
    const q = store.get(record.id);
    q.onsuccess = () => {
      const old = q.result;
      if ((old?.revision || 0) !== expected && expected !== null) {
        tx.abort();
        return;
      }
      const before = old ? { ...old, history: undefined } : null;
      const next = {
        ...record,
        revision: (old?.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      next.history = [
        ...(old?.history || []),
        {
          at: next.updatedAt,
          action,
          before,
          after: { ...next, history: undefined },
        },
      ];
      store.put(next);
    };
  });
}
export async function importBackup(data, restoreConfig = false) {
  if (
    !data ||
    data.format !== "mi-control-laboral" ||
    data.version !== 1 ||
    !Array.isArray(data.records) ||
    data.records.length > 50000
  )
    throw Error("Formato de respaldo no compatible");
  validateConfig(data.config);
  const seen = new Set();
  for (const r of data.records) {
    validateRecord(r);
    if (seen.has(r.id))
      throw Error("El respaldo contiene registros duplicados");
    seen.add(r.id);
  }
  let added = 0,
    skipped = 0;
  await transaction(["records", "settings"], "readwrite", (tx) => {
    if (restoreConfig) tx.objectStore("settings").put(data.config, "config");
    const store = tx.objectStore("records");
    for (const r of data.records) {
      const q = store.get(r.id);
      q.onsuccess = () => {
        if (q.result) {
          skipped++;
          return;
        }
        const at = new Date().toISOString();
        store.add({
          ...r,
          revision: 1,
          updatedAt: at,
          history: [
            ...r.history,
            {
              at,
              action: "Importación JSON",
              before: null,
              after: { ...r, history: undefined },
            },
          ],
        });
        added++;
      };
    }
  });
  return { added, skipped };
}
