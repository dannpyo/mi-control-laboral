const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const base =
  process.env.TEST_URL || "http://localhost:8768/mi-control-laboral/";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await browser.newContext({
    ...devices["Pixel 7"],
    timezoneId: "America/Asuncion",
    acceptDownloads: true,
  });
  await c.addInitScript(() => {
    window.__permission = "granted";
    window.__permissionRequests = 0;
    window.__picks = 0;
    window.__writes = 0;
    window.__failWrite = false;
    FileSystemDirectoryHandle.prototype.queryPermission = async () =>
      window.__permission;
    FileSystemDirectoryHandle.prototype.requestPermission = async () => {
      window.__permissionRequests++;
      return window.__permission;
    };
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        if (!navigator.userActivation.isActive) throw Error("Falta gesto");
        window.__picks++;
        return (await navigator.storage.getDirectory()).getDirectoryHandle(
          "respaldo-test",
          { create: true },
        );
      },
    });
    const original = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (...args) {
      const writable = await original.apply(this, args);
      return {
        write: async (text) => {
          window.__writes++;
          if (window.__failWrite) throw Error("Disco lleno simulado");
          await writable.write(text);
        },
        close: () => writable.close(),
        abort: () => writable.abort(),
      };
    };
  });
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const waitFor = async (predicate) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await p.evaluate(predicate)) return;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw Error("Condición de IndexedDB no alcanzada");
  };
  await p.clock.install({ time: new Date("2026-11-12T07:30:00-03:00") });
  await p.goto(base);
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  await p
    .getByRole("button", {
      name: "Seleccionar carpeta de destino",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await p.evaluate(() => window.__picks + window.__permissionRequests),
    0,
  );
  await p
    .getByRole("button", {
      name: "Seleccionar carpeta de destino",
      exact: true,
    })
    .click();
  await p
    .getByRole("button", { name: "Cambiar carpeta", exact: true })
    .waitFor();
  assert.equal(await p.evaluate(() => window.__picks), 1);
  await p.locator("#auto-backup").check();
  await waitFor(
    async () =>
      (await (await import("./js/storage/db.js")).getBackupSettings()).enabled,
  );
  await p.getByRole("button", { name: "Inicio", exact: true }).click();
  await p.getByRole("button", { name: "Marcar entrada", exact: true }).click();
  const waitVerified = async () =>
    waitFor(async () => {
      const db = await import("./js/storage/db.js"),
        snap = await db.getSnapshot();
      return (
        snap.backup.lastVerifiedRevision === snap.revision &&
        !snap.backup.pending
      );
    });
  await waitVerified();
  assert.equal(await p.evaluate(() => window.__writes), 1);
  await p.clock.setFixedTime(new Date("2026-11-12T19:31:00-03:00"));
  await p.getByRole("button", { name: "Marcar salida", exact: true }).click();
  await waitFor(async () => {
    const rows = await (await import("./js/storage/db.js")).getRecords();
    return rows[0]?.exit === "19:31";
  });
  await waitVerified();
  assert.equal(await p.evaluate(() => window.__writes), 2);
  await p
    .getByRole("button", { name: "Corregir o ingresar horario", exact: true })
    .click();
  await p.locator("[name=exit]").fill("19:32");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await waitVerified();
  assert.equal(await p.evaluate(() => window.__writes), 3);
  async function files() {
    return p.evaluate(async () => {
      const root = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle("respaldo-test");
      const result = [];
      async function walk(dir, prefix = "") {
        for await (const [name, h] of dir.entries()) {
          if (h.kind === "directory") await walk(h, prefix + name + "/");
          else
            result.push({
              name: prefix + name,
              text: await (await h.getFile()).text(),
            });
        }
      }
      await walk(root);
      return result.sort((a, b) => a.name.localeCompare(b.name));
    });
  }
  const previous = await files();
  assert.equal(previous.length, 3);
  assert.ok(
    previous.every((f) => f.name.startsWith("MiControlLaboral/2026-11-12/")),
  );
  assert.equal(JSON.parse(previous[0].text).format, "mi-control-laboral");
  assert.equal("handle" in JSON.parse(previous[0].text), false);
  // Datos sintéticos adicionales para verificar que la limpieza conserva TODA la configuración.
  await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      config = await db.getConfig();
    config.holidays = ["2026-12-25"];
    await db.saveConfig(config);
    localStorage.setItem("mi-control-laboral-theme", "light");
  });
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await waitVerified();
  assert.equal(await p.evaluate(() => window.__permissionRequests), 0);
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  await p
    .getByRole("button", { name: "Crear respaldo ahora", exact: true })
    .click();
  await p
    .getByRole("status")
    .filter({ hasText: "Respaldo guardado y verificado" })
    .waitFor();
  const fullFiles = await files();
  const before = await p.evaluate(async () => {
    const db = await import("./js/storage/db.js");
    return {
      config: await db.getConfig(),
      backup: {
        ...(await db.getBackupSettings()),
        handle: {
          name: (await db.getBackupSettings()).handle.name,
          kind: (await db.getBackupSettings()).handle.kind,
        },
      },
      theme: localStorage.getItem("mi-control-laboral-theme"),
    };
  });
  assert.equal(before.backup.handle.kind, "directory");
  // Denegado y revocado: ni consultas de estado ni guardados solicitan permiso por sí solos.
  await p.evaluate(() => (window.__permission = "denied"));
  await p.getByRole("button", { name: "Cambiar carpeta", exact: true }).click();
  await p.getByRole("status").filter({ hasText: "No hay permiso" }).waitFor();
  await p.evaluate(() => (window.__permission = "granted"));
  const openClear = async () => {
    const dismiss = p.getByRole("button", {
      name: "Cerrar aviso",
      exact: true,
    });
    if (await dismiss.isVisible()) await dismiss.click();
    await p
      .getByRole("button", { name: "Borrar todos los registros", exact: true })
      .click();
  };
  // Cancelar la primera y la segunda confirmación no elimina nada.
  await openClear();
  let dlg = p.getByRole("dialog", {
    name: "Borrar todos los registros",
    exact: true,
  });
  assert.match(await dlg.innerText(), /1 jornadas/);
  assert.equal(await dlg.locator("#final-clear-step").isVisible(), false);
  await dlg.getByRole("button", { name: "Cancelar", exact: true }).click();
  assert.equal(
    await p.evaluate(
      async () =>
        (await (await import("./js/storage/db.js")).getRecords()).length,
    ),
    1,
  );
  await openClear();
  dlg = p.getByRole("dialog", {
    name: "Borrar todos los registros",
    exact: true,
  });
  let download = p.waitForEvent("download");
  await dlg
    .getByRole("button", {
      name: "Descargar respaldo antes de borrar",
      exact: true,
    })
    .click();
  await download;
  await dlg
    .getByRole("button", { name: "Confirmar primera vez", exact: true })
    .click();
  await dlg.locator("#clear-word").fill("borrar");
  assert.equal(
    await dlg
      .getByRole("button", { name: "Borrar definitivamente", exact: true })
      .isDisabled(),
    true,
  );
  await dlg.getByRole("button", { name: "Cancelar", exact: true }).click();
  assert.equal(
    await p.evaluate(
      async () =>
        (await (await import("./js/storage/db.js")).getRecords()).length,
    ),
    1,
  );
  // Un cambio concurrente invalida la cantidad y confirmación antigua.
  await openClear();
  dlg = p.getByRole("dialog", {
    name: "Borrar todos los registros",
    exact: true,
  });
  await dlg
    .getByRole("button", { name: "Confirmar primera vez", exact: true })
    .click();
  await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      r = (await db.getRecords())[0];
    await db.saveRecord(
      {
        ...r,
        notes: "Cambio concurrente",
        entry: "09:30",
        exit: "18:00",
        lateState: "unjustified",
        earlyState: "unjustified",
        officialEntry: "missing",
        officialExit: "marked",
        closed: true,
      },
      "Prueba",
      r.revision,
    );
    const d = await import("./js/modules/domain.js");
    await db.saveRecord(
      { ...d.blank("2026-11-05", "2", await db.getConfig()), entry: "07:30" },
      "Omisión histórica",
      0,
    );
  });
  await dlg.locator("#clear-word").fill("BORRAR");
  await dlg
    .getByRole("button", { name: "Borrar definitivamente", exact: true })
    .click();
  await dlg
    .locator("#clear-feedback")
    .filter({ hasText: "datos cambiaron" })
    .waitFor();
  await dlg.getByRole("button", { name: "Cancelar", exact: true }).click();
  const incidenceBeforeClear = await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const s = d.stats(
      await db.getRecords(),
      await db.getConfig(),
      "2",
      d.period("2026-11-12"),
      new Date("2026-11-12T20:00:00"),
    );
    return [s.late, s.early, s.omissions];
  });
  assert.deepEqual(incidenceBeforeClear, [1, 1, 1]);
  const copiesBeforeClear = await files();
  await openClear();
  dlg = p.getByRole("dialog", {
    name: "Borrar todos los registros",
    exact: true,
  });
  await dlg
    .getByRole("button", { name: "Confirmar primera vez", exact: true })
    .click();
  await dlg.locator("#clear-word").fill("BORRAR");
  await dlg
    .getByRole("button", { name: "Borrar definitivamente", exact: true })
    .click();
  await dlg.waitFor({ state: "hidden" });
  const after = await p.evaluate(async () => {
    const db = await import("./js/storage/db.js");
    const backup = await db.getBackupSettings();
    return {
      records: await db.getRecords(),
      config: await db.getConfig(),
      backup: {
        enabled: backup.enabled,
        groupDaily: backup.groupDaily,
        handleName: backup.handle.name,
        paused: backup.pausedAfterClear,
        pending: backup.pending,
        lastVerifiedAt: backup.lastVerifiedAt,
      },
      theme: localStorage.getItem("mi-control-laboral-theme"),
    };
  });
  assert.equal(after.records.length, 0);
  assert.deepEqual(after.config, before.config);
  assert.equal(after.theme, before.theme);
  assert.equal(after.backup.enabled, true);
  assert.equal(after.backup.handleName, before.backup.handle.name);
  assert.equal(after.backup.paused, true);
  assert.equal(after.backup.pending, true);
  assert.equal(after.backup.lastVerifiedAt, before.backup.lastVerifiedAt);
  assert.deepEqual(await files(), copiesBeforeClear);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(await p.locator("#saved-entry").textContent(), "— — : — —");
  assert.equal(
    await p.evaluate(
      async () =>
        (await (await import("./js/storage/db.js")).getRecords()).length,
    ),
    0,
  );
  assert.deepEqual(await files(), copiesBeforeClear);
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  for (const id of ["1", "2", "3"])
    for (const label of [
      "Tardanzas: 0",
      "Salidas anticipadas: 0",
      "Omisiones de marcación: 0",
    ])
      assert.equal(
        await p
          .locator(`[data-summary-link="${id}"]`)
          .getByLabel(label, { exact: true })
          .count(),
        1,
      );
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  assert.equal(await p.locator(".link-marker.incident").count(), 0);
  assert.ok((await p.locator(".link-marker.scheduled").count()) > 0);
  // Un nuevo registro NO levanta la pausa ni crea un respaldo vacío intermedio.
  await p.getByRole("button", { name: "Inicio", exact: true }).click();
  await p.getByRole("button", { name: "Marcar entrada", exact: true }).click();
  await waitFor(
    async () =>
      (await (await import("./js/storage/db.js")).getRecords()).length === 1,
  );
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(await files(), copiesBeforeClear);
  // Importar un JSON automático funciona; las preferencias de respaldo no pertenecen al JSON.
  const auto = JSON.parse(previous.at(-1).text);
  const restored = await p.evaluate(async (data) => {
    const db = await import("./js/storage/db.js");
    return db.importBackup(data);
  }, auto);
  assert.equal(restored.skipped, 1);
  // Error de escritura después de editar no revierte la jornada ni modifica la última copia verificada.
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  await p
    .getByRole("button", { name: "Crear respaldo ahora", exact: true })
    .click();
  await p
    .getByRole("status")
    .filter({ hasText: "Respaldo guardado y verificado" })
    .waitFor();
  await waitFor(
    async () =>
      !(await (await import("./js/storage/db.js")).getBackupSettings())
        .pausedAfterClear,
  );
  await p.evaluate(() => (window.__failWrite = true));
  await p.getByRole("button", { name: "Inicio", exact: true }).click();
  await p
    .getByRole("button", { name: "Corregir o ingresar horario", exact: true })
    .click();
  await p.locator("[name=entry]").fill("08:00");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await waitFor(async () =>
    (
      await (await import("./js/storage/db.js")).getBackupSettings()
    ).error?.includes("Disco lleno"),
  );
  assert.equal(
    (
      await p.evaluate(
        async () =>
          (await (await import("./js/storage/db.js")).getRecords())[0],
      )
    ).entry,
    "08:00",
  );
  // API ausente y recordatorio: solo se muestra en Datos y respaldos, con descarga manual disponible.
  const fallback = await browser.newContext();
  await fallback.addInitScript(() =>
    Object.defineProperty(window, "showDirectoryPicker", { value: undefined }),
  );
  const pf = await fallback.newPage();
  await pf.goto(base);
  await pf.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await pf.evaluate(async () =>
    (await import("./js/storage/db.js")).updateBackupSettings({
      reminderSince: "2020-01-01T00:00:00Z",
    }),
  );
  await pf.getByRole("button", { name: "Configuración", exact: true }).click();
  await pf.getByText("Han pasado siete días:", { exact: false }).waitFor();
  assert.match(
    await pf.locator("#backup-controls").innerText(),
    /no disponible/,
  );
  assert.equal(
    await pf
      .getByRole("button", { name: "Exportar JSON", exact: true })
      .isEnabled(),
    true,
  );
  const importedAuto = await pf.evaluate(async (data) => {
    const db = await import("./js/storage/db.js");
    const result = await db.importBackup(data, true);
    return { result, rows: await db.getRecords() };
  }, auto);
  assert.equal(importedAuto.result.added, 1);
  assert.equal(importedAuto.rows[0].exit, auto.records[0].exit);
  assert.deepEqual(
    importedAuto.rows[0].history.slice(0, -1),
    auto.records[0].history,
  );
  await fallback.close();
  await c.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(
    (
      await p.evaluate(
        async () =>
          (await (await import("./js/storage/db.js")).getRecords())[0],
      )
    ).entry,
    "08:00",
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS Datos: carpeta/handle IDB, permisos simulados, entrada/salida/edición, verificación y copias únicas, JSON, error sin pérdida, doble confirmación/cancelar/concurrencia, borrado selectivo, pausa tras borrar, fallback semanal, persistencia y offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
