import { getSnapshot, clearAllRecords } from "../storage/db.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function backupControls() {
  return `<div id="backup-controls"><p class="muted">Comprobando respaldo…</p></div>
    <div class="actions"><button id="json-export">Exportar JSON</button><button id="csv-export" class="secondary">Exportar CSV</button></div>
    <label>Importar respaldo JSON (hasta 20 MB)<input id="json-import" type="file" accept="application/json,.json"></label>
    <label class="check"><input type="checkbox" id="restore-config">Restaurar también la configuración del respaldo</label>
    <p class="muted">La importación conserva jornadas coincidentes. Los respaldos incluyen configuración e historial, no permisos de carpeta. No se envían datos a servicios externos.</p>
    <hr><h3>Limpieza de registros</h3><p class="muted">Conserva horarios, feriados, tolerancias, apariencia y ajustes de respaldo.</p>
    <button id="clear-records" class="secondary">Borrar todos los registros</button>`;
}
export function createBackupUI(manager, { notice, manualExport, onCleared }) {
  let refreshId = 0;
  async function refresh() {
    const el = document.querySelector("#backup-controls");
    if (!el) return;
    const id = ++refreshId;
    try {
      const status = await manager.status();
      if (id !== refreshId || !el.isConnected) return;
      const { prefs, supported, granted } = status;
      el.innerHTML = `<p role="status">Estado: <strong>${status.state}</strong></p><p class="muted">Último respaldo verificado: ${prefs.lastVerifiedAt ? esc(new Date(prefs.lastVerifiedAt).toLocaleString("es-PY")) : "Ninguno"}</p>
        <label class="check"><input id="auto-backup" type="checkbox" ${prefs.enabled ? "checked" : ""} ${!supported && !prefs.enabled ? "disabled" : ""}>Respaldo automático</label>
        <p class="muted">Carpeta: ${prefs.handle ? esc(prefs.handle.name) : "Sin seleccionar"}</p>
        ${!supported ? '<p class="muted">Este navegador no admite el acceso seguro a carpetas. Usa Exportar JSON manualmente. El recordatorio se muestra aquí cada siete días.</p>' : `<div class="actions"><button id="choose-backup-folder" class="secondary">${prefs.handle ? "Cambiar carpeta" : "Seleccionar carpeta de destino"}</button><button id="backup-now" ${!prefs.handle ? "disabled" : ""}>Crear respaldo ahora</button></div><label class="check"><input id="group-backups" type="checkbox" ${prefs.groupDaily ? "checked" : ""}>Agrupar por día y omitir copias sin cambios</label>${prefs.handle && !granted ? '<p class="muted">Permiso no vigente. Pulsa Crear respaldo ahora para autorizar de nuevo o selecciona otra carpeta.</p>' : ""}`}
        ${prefs.pausedAfterClear ? '<p class="muted">Después del borrado el respaldo automático está en pausa. Pulsa Crear respaldo ahora para decidir guardar un nuevo estado y reanudarlo.</p>' : ""}
        ${prefs.error ? `<p class="muted">${esc(prefs.error)}</p>` : ""}${status.reminder ? '<p class="compact-alert preventive" role="status">Han pasado siete días: exporta un respaldo JSON y guárdalo fuera del navegador.</p>' : ""}`;
      el.querySelector("#auto-backup").onchange = async (e) => {
        try {
          await manager.setEnabled(e.target.checked);
          await refresh();
          if (e.target.checked) await automatic();
        } catch (e) {
          notice(e.message, true);
        }
      };
      el.querySelector("#choose-backup-folder")?.addEventListener(
        "click",
        async () => {
          try {
            await manager.chooseDirectory();
            await refresh();
            const status = await manager.status();
            if (status.prefs.enabled) await automatic();
          } catch (e) {
            if (e.name !== "AbortError") notice(e.message, true);
          }
        },
      );
      el.querySelector("#group-backups")?.addEventListener(
        "change",
        async (e) => {
          await manager.setGrouping(e.target.checked);
          await refresh();
        },
      );
      el.querySelector("#backup-now")?.addEventListener("click", async () => {
        const button = el.querySelector("#backup-now");
        button.disabled = true;
        try {
          await manager.requestAccess();
          const snapshot = await getSnapshot();
          if (
            snapshot.records.length === 0 &&
            !confirm(
              "No hay jornadas. ¿Crear un respaldo del estado vacío? Los respaldos anteriores se conservarán.",
            )
          )
            return;
          const result = await manager.createNow({ manual: true });
          notice(
            result.verified
              ? "Respaldo guardado y verificado."
              : "Respaldo pendiente. Reintenta o usa Exportar JSON.",
            !result.verified,
          );
        } catch (e) {
          notice(e.message, true);
        } finally {
          await refresh();
        }
      });
    } catch (e) {
      el.textContent = "Respaldo no disponible: " + e.message;
    }
  }
  async function automatic() {
    // La escritura laboral ya terminó antes de llegar aquí. Un fallo de respaldo es independiente.
    try {
      await manager.createNow();
    } catch {
    } finally {
      await refresh();
    }
  }
  function bindClear() {
    document
      .querySelector("#clear-records")
      ?.addEventListener("click", async () => {
        try {
          const snapshot = await getSnapshot();
          const dialog = document.createElement("dialog");
          dialog.setAttribute("aria-labelledby", "clear-title");
          dialog.innerHTML = `<h2 id="clear-title">Borrar todos los registros</h2><p>Se eliminarán <strong>${snapshot.records.length} jornadas</strong> y sus historiales. No podrás recuperarlos sin un respaldo.</p><p class="muted">Los archivos JSON existentes y todas las configuraciones se conservarán.</p><div class="actions"><button id="clear-export" class="secondary">Descargar respaldo antes de borrar</button><button id="clear-folder" class="secondary" ${!manager.supported() ? "disabled" : ""}>Crear copia en carpeta</button></div><div id="first-clear-step"><button id="clear-first">Confirmar primera vez</button></div><form id="final-clear-step" hidden><label>Segunda confirmación: escribe BORRAR<input id="clear-word" autocomplete="off" spellcheck="false" required pattern="BORRAR"></label><button id="clear-final" type="submit" disabled>Borrar definitivamente</button></form><p id="clear-feedback" role="status"></p><button id="clear-cancel" class="text-button">Cancelar</button>`;
          document.body.append(dialog);
          dialog.showModal();
          let firstConfirmed = false;
          const feedback = dialog.querySelector("#clear-feedback");
          dialog.addEventListener("close", () => dialog.remove(), {
            once: true,
          });
          dialog.querySelector("#clear-cancel").onclick = () => dialog.close();
          dialog.querySelector("#clear-export").onclick = async () => {
            try {
              await manualExport(snapshot);
              feedback.textContent =
                "Descarga solicitada. Comprueba que guardaste el JSON antes de borrar.";
            } catch (e) {
              feedback.textContent = e.message;
            }
          };
          dialog.querySelector("#clear-folder").onclick = async () => {
            try {
              await manager.requestAccess();
              const result = await manager.createNow({ manual: true });
              feedback.textContent = result.verified
                ? "Copia guardada y verificada."
                : "No se pudo verificar la copia. Exporta JSON o reintenta.";
            } catch (e) {
              feedback.textContent = e.message;
            }
          };
          dialog.querySelector("#clear-first").onclick = () => {
            firstConfirmed = true;
            dialog.querySelector("#first-clear-step").hidden = true;
            dialog.querySelector("#final-clear-step").hidden = false;
            dialog.querySelector("#clear-word").focus();
          };
          dialog.querySelector("#clear-word").oninput = (e) => {
            dialog.querySelector("#clear-final").disabled =
              e.target.value !== "BORRAR";
          };
          dialog.querySelector("#final-clear-step").onsubmit = async (e) => {
            e.preventDefault();
            if (
              !firstConfirmed ||
              dialog.querySelector("#clear-word").value !== "BORRAR"
            )
              return;
            dialog.querySelector("#clear-final").disabled = true;
            try {
              await clearAllRecords(snapshot.revision, snapshot.records.length);
              dialog.close();
              await onCleared();
              notice(
                "Registros borrados. Configuraciones y archivos de respaldo conservados.",
              );
            } catch (e) {
              feedback.textContent = e.message;
            }
          };
        } catch (e) {
          notice(e.message, true);
        }
      });
  }
  return { refresh, automatic, bindClear };
}
