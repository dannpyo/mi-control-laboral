const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({
    ...devices["Pixel 7"],
    timezoneId: "America/Asuncion",
  });
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.clock.install({ time: new Date("2026-11-15T20:00:00-03:00") });
  await p.goto(
    process.env.TEST_URL || "http://localhost:8769/mi-control-laboral/",
  );
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const cfg = await db.getConfig();
    cfg.startDate = "2026-10-16";
    await db.saveConfig(cfg);
    await db.saveRecord(
      {
        ...d.blank("2026-10-29", "2", cfg),
        entry: "08:08",
        notes: "Nota histórica que debe conservarse",
      },
      "Histórico",
      0,
    );
    await db.saveRecord(
      { ...d.blank("2026-10-18", "3", cfg), exit: "19:07", history: [] },
      "Histórico",
      0,
    );
  });
  const original = await p.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.equal(
    await p
      .locator('[data-summary-link="2"]')
      .getByLabel("Tardanzas: 1", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await p
      .locator('[data-summary-link="2"]')
      .getByLabel("Omisiones de marcación: 1", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await p
      .locator('[data-summary-link="3"]')
      .getByLabel("Omisiones de marcación: 1", { exact: true })
      .count(),
    1,
  );
  assert.match(
    await p.locator('[data-summary-link="2"]').innerText(),
    /Posibles ausencias: 3/,
  );
  assert.deepEqual(
    await p.evaluate(async () =>
      (await import("./js/storage/db.js")).getRecords(),
    ),
    original,
  );
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator("#month").fill("2026-10");
  await p.locator('[data-day="2026-10-29"]').click();
  assert.equal(await p.locator("#view [data-edit]").count(), 1);
  assert.match(
    await p.locator(".record-card .status").innerText(),
    /38 min.*1 omisión/,
  );
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  for (const name of [
    "officialEntry",
    "officialExit",
    "closed",
    "scheduleStart",
    "scheduleEnd",
  ])
    assert.equal(await p.locator(`[name="${name}"]`).count(), 0);
  assert.equal(await p.locator("#more-options").getAttribute("open"), null);
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=lateJustified]").check();
  await p.locator("[name=omissionJustified]").check();
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  const updated = await p.evaluate(async () =>
    (await (await import("./js/storage/db.js")).getRecords()).find(
      (r) => r.date === "2026-10-29",
    ),
  );
  assert.equal(updated.entry, "08:08");
  assert.equal(updated.exit, "");
  assert.equal(updated.closed, false);
  assert.equal(updated.officialEntry, "pending");
  assert.equal(updated.notes, "Nota histórica que debe conservarse");
  assert.deepEqual(
    updated.history[0],
    original.find((r) => r.date === "2026-10-29").history[0],
  );
  assert.equal(updated.history.length, 2);
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  let v2 = p.locator('[data-summary-link="2"]');
  assert.equal(await v2.getByLabel("Tardanzas: 0", { exact: true }).count(), 1);
  assert.equal(
    await v2.getByLabel("Omisiones de marcación: 0", { exact: true }).count(),
    1,
  );
  await v2.locator("summary").click();
  assert.match(
    await v2.innerText(),
    /Omisiones: 1 detectadas · 1 justificadas · 0 computables/,
  );
  async function classify(date, type) {
    await p.getByRole("button", { name: "Calendario", exact: true }).click();
    await p.locator("#month").fill(date.slice(0, 7));
    await p.locator(`[data-day="${date}"]`).click();
    assert.equal(await p.locator(".record-card").count(), 1);
    assert.match(
      await p.locator(".record-card .status").innerText(),
      /Posible ausencia/,
    );
    await p.getByRole("button", { name: "Editar", exact: true }).click();
    await p.getByText("Justificar / excepción", { exact: true }).click();
    await p.locator("[name=type]").selectOption(type);
    await p
      .getByRole("button", { name: "Guardar jornada", exact: true })
      .click();
    await p.locator("#editor").waitFor({ state: "hidden" });
  }
  await classify("2026-10-25", "permission");
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.match(
    await p.locator('[data-summary-link="3"]').innerText(),
    /Posibles ausencias: 3/,
  );
  await classify("2026-11-01", "double-omission");
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.equal(
    await p
      .locator('[data-summary-link="3"]')
      .getByLabel("Omisiones de marcación: 3", { exact: true })
      .count(),
    1,
  );
  await classify("2026-11-08", "unjustified");
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.match(
    await p.locator('[data-summary-link="3"]').innerText(),
    /Posibles ausencias: 1/,
  );
  // Superar la salida recalcula en pantalla sin navegar, confirmar ni cerrar jornada.
  await p.clock.setFixedTime(new Date("2026-11-12T19:30:00-03:00"));
  await p.clock.runFor(1100);
  await p.getByRole("button", { name: "Inicio", exact: true }).click();
  await p
    .getByRole("button", { name: "Corregir o ingresar horario", exact: true })
    .click();
  await p.locator("[name=entry]").fill("07:30");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await p
      .locator(".current-period")
      .getByLabel("Omisiones de marcación: 0", { exact: true })
      .count(),
    1,
  );
  await p.clock.setFixedTime(new Date("2026-11-12T19:30:01-03:00"));
  await p.clock.runFor(1100);
  assert.equal(
    await p
      .locator(".current-period")
      .getByLabel("Omisiones de marcación: 1", { exact: true })
      .count(),
    1,
  );
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  await p
    .getByRole("button", { name: "Período siguiente", exact: true })
    .click();
  assert.equal(
    await p
      .locator('[data-summary-link="2"]')
      .getByLabel("Omisiones de marcación: 0", { exact: true })
      .count(),
    1,
  );
  // Una excepción eximente histórica no se transforma en doble omisión al abrir/guardar.
  await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const cfg = await db.getConfig();
    await db.saveRecord(
      {
        ...d.blank("2026-11-11", "1", cfg),
        type: "permission",
        closed: true,
        officialEntry: "missing",
        officialExit: "missing",
        notes: "Excepción antigua",
      },
      "Histórico exento",
      0,
    );
  });
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator('[data-day="2026-11-11"]').click();
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  assert.equal(await p.locator("[name=type]").inputValue(), "permission");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  const exempt = await p.evaluate(async () =>
    (await (await import("./js/storage/db.js")).getRecords()).find(
      (r) => r.date === "2026-11-11",
    ),
  );
  assert.equal(exempt.type, "permission");
  assert.equal(exempt.notes, "Excepción antigua");
  assert.equal(exempt.officialEntry, "missing");
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  const wait = p.waitForEvent("download");
  await p.getByRole("button", { name: "Exportar JSON", exact: true }).click();
  const downloaded = await wait;
  const dest = path.join(os.tmpdir(), "mandatory-" + Date.now() + ".json");
  await downloaded.saveAs(dest);
  const data = JSON.parse(fs.readFileSync(dest));
  const raw = await p.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(data.records.length, raw.length);
  assert.ok(data.records.every((r) => !r.virtual));
  const fresh = await b.newContext();
  const f = await fresh.newPage();
  await f.goto(
    process.env.TEST_URL || "http://localhost:8769/mi-control-laboral/",
  );
  await f.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  const result = await f.evaluate(
    async (data) =>
      (await import("./js/storage/db.js")).importBackup(data, true),
    data,
  );
  assert.equal(result.added, data.records.length);
  assert.equal(
    (
      await f.evaluate(async () =>
        (await (await import("./js/storage/db.js")).getRecords()).find(
          (r) => r.date === "2026-10-29",
        ),
      )
    ).omissionJustified,
    true,
  );
  await fresh.close();
  fs.unlinkSync(dest);
  await c.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator("#month").fill("2026-10");
  await p.locator('[data-day="2026-10-29"]').click();
  assert.match(
    await p.locator(".record-card .status").innerText(),
    /justificada/,
  );
  for (const width of [320, 390, 1440]) {
    await p.setViewportSize({ width, height: 844 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  assert.deepEqual(errors, []);
  await b.close();
  console.log(
    "PASS asistencia obligatoria: ejemplos, virtuales sin escrituras, editor breve, justificaciones/historial, permiso/doble omisión/ausencia explícita, actualización al superar salida, período, JSON e importación y offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
