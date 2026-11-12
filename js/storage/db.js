import {
  validateData as validatePrivateData,
  mergePrivateData,
} from "../private/domain.js";
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
    tx.onabort = () =>
      reject(tx.error || tx.customError || Error("Operación cancelada"));
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
  return transaction(["settings"], "readwrite", (tx) => {
    tx.objectStore("settings").put(config, "config");
    bumpRevision(tx);
  });
}
export async function saveRecord(
  record,
  action = "Edición manual",
  expected = null,
) {
  validateRecord(record);
  return transaction(["records", "settings"], "readwrite", (tx) => {
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
      bumpRevision(tx);
    };
  });
}
export async function importBackup(
  data,
  restoreConfig = false,
  includePrivate = true,
) {
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
  if (data.privateGuards !== undefined) validatePrivateData(data.privateGuards);
  let added = 0,
    skipped = 0,
    privateResult;

  await transaction(["records", "settings"], "readwrite", (tx) => {
    if (restoreConfig) {
      tx.objectStore("settings").put(data.config, "config");
      bumpRevision(tx);
    }
    if (data.privateGuards !== undefined && includePrivate) {
      const settings = tx.objectStore("settings"),
        q = settings.get("privateGuards");
      q.onsuccess = () => {
        try {
          const merged = mergePrivateData(q.result, data.privateGuards);
          settings.put(
            { ...merged.data, revision: (q.result?.revision || 0) + 1 },
            "privateGuards",
          );
          privateResult = {
            privateAdded: merged.added,
            privateSkipped: merged.skipped,
          };
          bumpRevision(tx);
        } catch (error) {
          tx.customError = error;
          tx.abort();
        }
      };
    }
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
        if (!restoreConfig && added === 0) bumpRevision(tx);
        added++;
      };
    }
  });
  return { added, skipped, ...privateResult };
}

// Metadatos fuera de config y del formato JSON; no se cambia la versión ni almacenes.
function bumpRevision(tx) {
  const store = tx.objectStore("settings"),
    q = store.get("dataRevision");
  q.onsuccess = () => store.put((q.result || 0) + 1, "dataRevision");
}
export function backupDefaults() {
  return {
    enabled: false,
    handle: null,
    groupDaily: true,
    generation: 0,
    pending: true,
    pausedAfterClear: false,
    lastVerifiedAt: null,
    lastVerifiedRevision: null,
    lastFingerprint: null,
    lastDay: null,
    lastFilename: null,
    lastManualExportAt: null,
    reminderSince: new Date().toISOString(),
    error: null,
  };
}
export async function getBackupSettings() {
  return transaction(["settings"], "readwrite", (tx) => {
    const store = tx.objectStore("settings"),
      q = store.get("backupSettings");
    q.onsuccess = () => {
      if (!q.result) store.put(backupDefaults(), "backupSettings");
    };
    return () => q.result || backupDefaults();
  });
}
export async function updateBackupSettings(patch) {
  return transaction(["settings"], "readwrite", (tx) => {
    const store = tx.objectStore("settings"),
      q = store.get("backupSettings");
    let next;
    q.onsuccess = () => {
      next = { ...backupDefaults(), ...q.result, ...patch };
      store.put(next, "backupSettings");
    };
    return () => next;
  });
}
export async function setBackupDestination(handle) {
  return transaction(["settings"], "readwrite", (tx) => {
    const store = tx.objectStore("settings"),
      q = store.get("backupSettings");
    q.onsuccess = () => {
      const old = q.result || backupDefaults();
      store.put(
        {
          ...old,
          handle,
          generation: old.generation + 1,
          lastFingerprint: null,
          lastDay: null,
          pending: true,
          error: null,
        },
        "backupSettings",
      );
    };
  });
}
// Configuración y jornadas se leen en UNA transacción: una sola versión consistente.
export async function getSnapshot() {
  return transaction(["records", "settings"], "readonly", (tx) => {
    const settings = tx.objectStore("settings"),
      rows = tx.objectStore("records").getAll(),
      config = settings.get("config"),
      revision = settings.get("dataRevision"),
      backup = settings.get("backupSettings"),
      privateGuards = settings.get("privateGuards");
    return () => ({
      records: rows.result,
      config: config.result,
      revision: revision.result || 0,
      backup: backup.result || backupDefaults(),
      privateGuards: privateGuards.result,
    });
  });
}
export async function commitVerifiedBackup(info) {
  return transaction(["settings"], "readwrite", (tx) => {
    const store = tx.objectStore("settings"),
      q = store.get("backupSettings"),
      r = store.get("dataRevision");
    let saved = false;
    r.onsuccess = () => {
      const prefs = q.result || backupDefaults();
      if (prefs.generation !== info.generation) return;
      store.put(
        {
          ...prefs,
          lastVerifiedAt: info.at,
          lastVerifiedRevision: info.revision,
          lastFilename: info.filename,
          lastFingerprint: info.fingerprint,
          lastDay: info.day,
          pending: (r.result || 0) !== info.revision,
          pausedAfterClear: false,
          error: null,
        },
        "backupSettings",
      );
      saved = true;
    };
    return () => saved;
  });
}
// El borrado y la pausa del respaldo son atómicos; config y handle nunca se borran.
export async function clearAllRecords(expectedRevision, expectedCount) {
  return transaction(["records", "settings"], "readwrite", (tx) => {
    const settings = tx.objectStore("settings"),
      store = tx.objectStore("records");
    const revision = settings.get("dataRevision"),
      prefs = settings.get("backupSettings"),
      count = store.count();
    count.onsuccess = () => {
      if (
        (revision.result || 0) !== expectedRevision ||
        count.result !== expectedCount
      ) {
        tx.customError = Error(
          "Los datos cambiaron. Vuelve a revisar la cantidad y confirmar el borrado.",
        );
        tx.abort();
        return;
      }
      store.clear();
      settings.put((revision.result || 0) + 1, "dataRevision");
      const old = prefs.result || backupDefaults();
      settings.put(
        {
          ...old,
          generation: old.generation + 1,
          pausedAfterClear: true,
          pending: true,
          error: null,
        },
        "backupSettings",
      );
    };
  });
}

// Módulo privado separado en settings: mismo origen, versión y almacenes existentes.
export async function getPrivateGuards() {
  return transaction(["settings"], "readonly", (tx) => {
    const q = tx.objectStore("settings").get("privateGuards");
    return () => q.result;
  });
}
export async function savePrivateGuards(data, expectedRevision) {
  validatePrivateData(data);
  return transaction(["settings"], "readwrite", (tx) => {
    const settings = tx.objectStore("settings"),
      q = settings.get("privateGuards");
    let next;
    q.onsuccess = () => {
      if ((q.result?.revision || 0) !== expectedRevision) {
        tx.customError = Error(
          "Guardias privadas cambió en otra pestaña. Cierra el formulario y vuelve a abrirlo.",
        );
        tx.abort();
        return;
      }
      next = { ...data, revision: (q.result?.revision || 0) + 1 };
      settings.put(next, "privateGuards");
      bumpRevision(tx);
    };
    return () => next;
  });
}
