import { validateData as validatePrivateData } from "../private/domain.js";
import * as storage from "../storage/db.js";
import {
  validateConfig,
  validateRecord,
  localDate,
} from "../modules/domain.js";

export function supportsDirectoryAccess(env = globalThis) {
  const d = env.FileSystemDirectoryHandle?.prototype,
    f = env.FileSystemFileHandle?.prototype;
  return (
    typeof env.showDirectoryPicker === "function" &&
    typeof env.navigator?.locks?.request === "function" &&
    [
      "getDirectoryHandle",
      "getFileHandle",
      "queryPermission",
      "requestPermission",
    ].every((k) => typeof d?.[k] === "function") &&
    ["createWritable", "getFile"].every((k) => typeof f?.[k] === "function")
  );
}
export function backupDocument(snapshot, at = new Date()) {
  validateConfig(snapshot.config);
  snapshot.records.forEach(validateRecord);
  if (snapshot.privateGuards !== undefined)
    validatePrivateData(snapshot.privateGuards);
  return {
    format: "mi-control-laboral",
    version: 1,
    exportedAt: at.toISOString(),
    config: snapshot.config,
    records: snapshot.records,
    ...(snapshot.privateGuards !== undefined
      ? { privateGuards: snapshot.privateGuards }
      : {}),
  };
}
export function reminderDue(prefs, now = new Date()) {
  const last = Math.max(
    ...[prefs.lastManualExportAt, prefs.lastVerifiedAt, prefs.reminderSince]
      .map(Date.parse)
      .filter(Number.isFinite),
  );
  return Number.isFinite(last) && now - last >= 7 * 86400000;
}
async function existingFile(directory, relative) {
  const parts = relative.split("/");
  for (const part of parts.slice(0, -1))
    directory = await directory.getDirectoryHandle(part);
  return directory.getFileHandle(parts.at(-1));
}
async function digest(text) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export function createBackupManager({
  db = storage,
  env = globalThis,
  now = () => new Date(),
} = {}) {
  let queue = Promise.resolve();
  const supported = () => supportsDirectoryAccess(env);
  async function permission(handle, request = false) {
    if (!handle) return false;
    try {
      let status = await handle.queryPermission({ mode: "readwrite" });
      if (status !== "granted" && request)
        status = await handle.requestPermission({ mode: "readwrite" });
      return status === "granted";
    } catch {
      return false;
    }
  }
  async function status() {
    const prefs = await db.getBackupSettings(),
      snapshot = await db.getSnapshot();
    const granted = supported() && (await permission(prefs.handle));
    return {
      prefs,
      supported: supported(),
      granted,
      reminder: !supported() && reminderDue(prefs, now()),
      state: prefs.pausedAfterClear
        ? "pendiente"
        : !supported()
          ? "no disponible"
          : !prefs.handle
            ? "pendiente"
            : !granted
              ? "no disponible"
              : prefs.pending ||
                  snapshot.revision !== prefs.lastVerifiedRevision
                ? "pendiente"
                : "actualizado",
    };
  }
  // Estas dos operaciones solo se invocan directamente desde botones del usuario.
  async function chooseDirectory() {
    if (!supported())
      throw Error(
        "Este navegador no permite seleccionar carpetas. Usa Exportar JSON.",
      );
    const handle = await env.showDirectoryPicker({
      mode: "readwrite",
      id: "mi-control-laboral-backups",
    });
    if (!(await permission(handle, true)))
      throw Error(
        "No hay permiso de lectura y escritura para esta carpeta. Puedes exportar JSON manualmente.",
      );
    await db.setBackupDestination(handle);
    return status();
  }
  async function requestAccess() {
    const prefs = await db.getBackupSettings();
    if (!(await permission(prefs.handle, true)))
      throw Error(
        "Permiso no concedido. Selecciona una carpeta o exporta JSON.",
      );
  }
  async function runBackup(manual = false) {
    const snapshot = await db.getSnapshot(),
      prefs = snapshot.backup;
    if (
      !manual &&
      (!prefs.enabled ||
        prefs.pausedAfterClear ||
        (snapshot.records.length === 0 &&
          !snapshot.privateGuards?.shifts.length &&
          !snapshot.privateGuards?.userConfigured &&
          !snapshot.privateGuards?.history.length))
    )
      return { skipped: true };
    if (!supported() || !prefs.handle || !(await permission(prefs.handle))) {
      await db.updateBackupSettings({
        pending: true,
        error:
          "Carpeta o permiso no disponible. Usa exportación manual o reintenta desde Configuración.",
      });
      return { pending: true };
    }
    const at = now(),
      day = localDate(at),
      data = backupDocument(snapshot, at);
    const fingerprint = await digest(
      JSON.stringify({
        config: data.config,
        records: data.records,
        privateGuards: data.privateGuards,
      }),
    );
    if (prefs.groupDaily && prefs.lastFingerprint === fingerprint) {
      // Se vuelve a comprobar el último archivo: no se presume íntegro si fue borrado o cambiado.
      try {
        const file = await existingFile(prefs.handle, prefs.lastFilename),
          text = await (await file.getFile()).text(),
          parsed = JSON.parse(text);
        if (
          parsed.format !== "mi-control-laboral" ||
          parsed.version !== 1 ||
          (await digest(
            JSON.stringify({
              config: parsed.config,
              records: parsed.records,
              privateGuards: parsed.privateGuards,
            }),
          )) !== fingerprint
        )
          throw Error("Archivo cambiado");
        const saved = await db.commitVerifiedBackup({
          generation: prefs.generation,
          at: at.toISOString(),
          day: prefs.lastDay,
          revision: snapshot.revision,
          filename: prefs.lastFilename,
          fingerprint,
        });
        return { verified: saved, reused: true };
      } catch {
        /* Crear otro archivo único; nunca reemplazar el que fue cambiado. */
      }
    }
    const text = JSON.stringify(data, null, 2);
    const stamp = `${day}_${String(at.getHours()).padStart(2, "0")}${String(at.getMinutes()).padStart(2, "0")}${String(at.getSeconds()).padStart(2, "0")}`;
    let filename, file;
    let directory = prefs.handle;
    const prefix = prefs.groupDaily ? `MiControlLaboral/${day}/` : "";
    if (prefs.groupDaily)
      directory = await (
        await directory.getDirectoryHandle("MiControlLaboral", { create: true })
      ).getDirectoryHandle(day, { create: true });
    // Un bloqueo entre pestañas (si se admite) y nombres exclusivos evitan sobrescrituras.
    for (let i = 0; i < 10000; i++) {
      filename = `MiControlLaboral_${stamp}${i ? "_" + String(i).padStart(3, "0") : ""}.json`;
      try {
        await directory.getFileHandle(filename);
        continue;
      } catch (e) {
        if (e.name !== "NotFoundError") throw e;
      }
      file = await directory.getFileHandle(filename, { create: true });
      break;
    }
    if (!file) throw Error("No se pudo reservar un nombre de respaldo único.");
    let writable;
    try {
      writable = await file.createWritable();
      await writable.write(text);
      await writable.close();
      const readback = await (await file.getFile()).text();
      if (readback !== text)
        throw Error("La verificación del archivo no coincide.");
      const parsed = JSON.parse(readback);
      if (parsed.format !== data.format || parsed.version !== 1)
        throw Error("Respaldo inválido");
      const saved = await db.commitVerifiedBackup({
        generation: prefs.generation,
        at: at.toISOString(),
        day,
        revision: snapshot.revision,
        filename: prefix + filename,
        fingerprint,
      });
      return { verified: saved, filename };
    } catch (e) {
      try {
        await writable?.abort();
      } catch {}
      throw e;
    }
  }
  function createNow({ manual = false } = {}) {
    const job = async () => {
      try {
        if (env.navigator?.locks?.request)
          return await env.navigator.locks.request(
            "mi-control-laboral-backup",
            () => runBackup(manual),
          );
        // Sin Web Locks no se escribe automáticamente desde varias pestañas sin exclusión.
        if (!manual) return { pending: true };
        return await runBackup(manual);
      } catch (e) {
        await db.updateBackupSettings({
          pending: true,
          error: `No se pudo verificar el respaldo: ${e.message}`,
        });
        return { pending: true, error: e.message };
      }
    };
    const next = queue.then(job, job);
    queue = next.catch(() => {});
    return next;
  }
  return {
    supported,
    status,
    chooseDirectory,
    requestAccess,
    createNow,
    setEnabled: (enabled) => db.updateBackupSettings({ enabled }),
    setGrouping: (groupDaily) =>
      db.updateBackupSettings({
        groupDaily,
        lastFingerprint: null,
        pending: true,
      }),
    noteManualExport: () =>
      db.updateBackupSettings({ lastManualExportAt: now().toISOString() }),
  };
}
