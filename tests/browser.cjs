// Flujo v2.0 con emulación móvil Android y datos sintéticos.
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const base =
  process.env.TEST_URL || "http://localhost:8766/mi-control-laboral/";
const launch = {
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
};
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "control-v2-"));
  const b = await chromium.launch(launch);
  const c = await b.newContext({
    ...devices["Pixel 7"],
    timezoneId: "America/Asuncion",
    locale: "es-PY",
    acceptDownloads: true,
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  p.on("dialog", (d) => d.accept());
  await p.clock.install({ time: new Date("2026-11-12T07:28:00-03:00") });
  await p.clock.pauseAt(new Date("2026-11-12T07:29:00-03:00"));
  await p.goto(base);
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal(await p.locator("nav button").count(), 4);
  assert.deepEqual(await p.locator("nav button").allTextContents(), [
    "Inicio",
    "Calendario",
    "Resumen",
    "Guardias",
  ]);
  assert.equal(await p.locator("#quick-link").inputValue(), "2");
  assert.equal(await p.locator("#live-clock").textContent(), "07:29:00");
  await p.clock.runFor(2100);
  assert.equal(await p.locator("#live-clock").textContent(), "07:29:02");
  assert.match(await p.locator(".timezone").innerText(), /America\/Asuncion/);
  await p
    .getByRole("button", { name: "Marcar entrada", exact: true })
    .dblclick();
  await p
    .getByRole("status")
    .filter({ hasText: "Marcación personal guardada" })
    .waitFor();
  assert.equal(await p.locator("#saved-entry").textContent(), "07:29");
  assert.equal(
    await p
      .getByRole("button", { name: "Marcar entrada", exact: true })
      .isDisabled(),
    true,
  );
  let rows = await p.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].history.length, 1);
  assert.equal(rows[0].officialEntry, "pending");
  await p.clock.setFixedTime(new Date("2026-11-12T19:30:00-03:00"));
  await p.getByRole("button", { name: "Marcar salida", exact: true }).click();
  await p.waitForFunction(
    () => document.querySelector("#saved-exit").textContent === "19:30",
  );
  assert.equal(
    await p
      .getByRole("button", { name: "Marcar salida", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await p.locator("#saved-entry").textContent(), "07:29");
  assert.match(
    await p.locator(".punch-card .status").innerText(),
    /Registrada/,
  );
  await p
    .getByRole("button", { name: "Corregir o ingresar horario", exact: true })
    .click();
  assert.equal(await p.locator("#more-options").getAttribute("open"), null);
  assert.equal(await p.locator("[name=entry]").isVisible(), true);
  assert.equal(await p.locator("[name=officialEntry]").isVisible(), false);
  await p.locator("[name=entry]").fill("07:46");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(await p.locator("#saved-entry").textContent(), "07:46");
  // Una clasificación concreta se hace dentro de un único desplegable, sin campos obligatorios adicionales.
  await p
    .getByRole("button", { name: "Corregir o ingresar horario", exact: true })
    .click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  assert.equal(await p.locator("[name=lateJustified]").isChecked(), false);
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await p
      .locator(".current-period")
      .getByLabel("Tardanzas: 1", { exact: true })
      .count(),
    1,
  );
  rows = await p.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rows[0].history.length, 4);
  assert.equal(rows[0].history[2].before.entry, "07:29");
  assert.equal(rows[0].history[2].after.entry, "07:46");
  await p
    .getByRole("button", { name: "Cambiar a modo claro", exact: true })
    .click();
  assert.equal(await p.locator("html").getAttribute("data-theme"), "light");
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(await p.locator("html").getAttribute("data-theme"), "light");
  assert.equal(await p.locator("#saved-entry").textContent(), "07:46");
  assert.equal(await p.locator("#quick-link").inputValue(), "2");
  await p
    .getByRole("button", { name: "Cambiar a modo oscuro", exact: true })
    .click();
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator('[data-day="2026-11-12"]').click();
  assert.equal(await p.locator("#view [data-edit]").count(), 1);
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.locator("[name=exit]").fill("19:31");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.equal(await p.locator(".summary-card").count(), 3);
  assert.equal(
    await p
      .locator('[data-summary-link="2"]')
      .getByLabel("Tardanzas: 1", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await p.getByText("Sin sanciones estimadas", { exact: true }).count(),
    3,
  );
  await p.locator('[data-summary-link="2"] summary').click();
  assert.match(
    await p.locator('[data-summary-link="2"] .incident-dates').innerText(),
    /12\/11\/2026.*Llegada tardía/,
  );
  await p
    .getByRole("button", { name: "Período siguiente", exact: true })
    .click();
  assert.equal(
    await p
      .locator('[data-summary-link="2"]')
      .getByLabel("Tardanzas: 0", { exact: true })
      .count(),
    1,
  );
  await p
    .getByRole("button", { name: "Período anterior", exact: true })
    .click();
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  let wait = p.waitForEvent("download");
  await p.getByRole("button", { name: "Exportar JSON", exact: true }).click();
  await (await wait).saveAs(path.join(temp, "backup.json"));
  const backup = JSON.parse(fs.readFileSync(path.join(temp, "backup.json")));
  assert.equal(backup.version, 1);
  assert.equal(backup.records.length, 1);
  wait = p.waitForEvent("download");
  await p.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  await (await wait).saveAs(path.join(temp, "export.csv"));
  assert.match(fs.readFileSync(path.join(temp, "export.csv"), "utf8"), /07:46/);
  await p.locator("#json-import").setInputFiles(path.join(temp, "backup.json"));
  await p
    .getByRole("status")
    .filter({ hasText: "0 nuevas; 1 coincidentes conservadas" })
    .waitFor();
  const checks = await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const config = await db.getConfig(),
      rows = await db.getRecords();
    let duplicate = false,
      invalid = false,
      stale = false;
    try {
      await db.importBackup({
        format: "mi-control-laboral",
        version: 1,
        config,
        records: [rows[0], rows[0]],
      });
    } catch {
      duplicate = true;
    }
    try {
      await db.importBackup({
        format: "mi-control-laboral",
        version: 1,
        config,
        records: [
          d.blank("2026-11-04", "1", config),
          { ...rows[0], date: "incorrecta" },
        ],
      });
    } catch {
      invalid = true;
    }
    await db.saveRecord(
      { ...rows[0], notes: "Actualización sintética" },
      "Concurrencia",
      rows[0].revision,
    );
    try {
      await db.saveRecord(rows[0], "Obsoleta", rows[0].revision);
    } catch {
      stale = true;
    }
    return { duplicate, invalid, stale, count: (await db.getRecords()).length };
  });
  assert.deepEqual(checks, {
    duplicate: true,
    invalid: true,
    stale: true,
    count: 1,
  });
  // Hora y vínculo cambian al llegar la medianoche sin pulsar nada ni perder formularios.
  await p.getByRole("button", { name: "Inicio", exact: true }).click();
  await p.clock.setFixedTime(new Date("2026-11-15T07:00:00-03:00"));
  await p.clock.runFor(1100);
  assert.equal(await p.locator("#quick-link").inputValue(), "3");
  await p.clock.setFixedTime(new Date("2026-11-16T00:00:00-03:00"));
  await p.clock.runFor(1100);
  assert.equal(await p.locator("#quick-link").inputValue(), "");
  assert.equal(
    await p
      .getByRole("button", { name: "Marcar entrada", exact: true })
      .isDisabled(),
    true,
  );
  await p.locator("#quick-link").selectOption("1");
  assert.match(await p.locator(".schedule").innerText(), /Excepcional/);
  await c.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator('[data-day="2026-11-12"]').click();
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.locator("[name=exit]").fill("19:32");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(
    (
      await p.evaluate(
        async () =>
          (await (await import("./js/storage/db.js")).getRecords())[0],
      )
    ).exit,
    "19:32",
  );
  // Lista reciente: máximo cinco, orden descendente y filtrada por el vínculo elegido.
  await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const config = await db.getConfig();
    for (const date of [
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ])
      await db.saveRecord(d.blank(date, "2", config), "Histórico sintético", 0);
  });
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.locator("#quick-link").selectOption("2");
  assert.equal(await p.locator(".recent-row").count(), 5);
  const recent = await p
    .locator(".recent-row")
    .evaluateAll((bs) =>
      bs.map((b) => ({ date: b.dataset.date, link: b.dataset.edit })),
    );
  assert.ok(recent.every((r) => r.link === "2"));
  assert.deepEqual(
    recent.map((r) => r.date),
    recent
      .map((r) => r.date)
      .sort()
      .reverse(),
  );
  // Reinicio real del navegador: JSON restaurado y apariencia conservada por origen.
  const profile = path.join(temp, "profile");
  let pc = await chromium.launchPersistentContext(profile, {
    ...launch,
    timezoneId: "UTC",
  });
  let pp = await pc.newPage();
  await pp.goto(base);
  await pp.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await pp.evaluate(async (backup) => {
    await (await import("./js/storage/db.js")).importBackup(backup, true);
    localStorage.setItem("mi-control-laboral-theme", "light");
  }, backup);
  await pc.close();
  pc = await chromium.launchPersistentContext(profile, {
    ...launch,
    timezoneId: "UTC",
  });
  pp = await pc.newPage();
  await pp.goto(base);
  await pp.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(await pp.locator("html").getAttribute("data-theme"), "light");
  assert.equal(
    (
      await pp.evaluate(
        async () =>
          (await (await import("./js/storage/db.js")).getRecords())[0],
      )
    ).entry,
    "07:46",
  );
  assert.match(
    await pp.locator(".timezone").innerText(),
    /UTC · prevista America\/Asuncion/,
  );
  const cdp = await pc.newCDPSession(pp);
  assert.deepEqual((await cdp.send("Page.getAppManifest")).errors, []);
  assert.deepEqual(
    (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
    [],
  );
  await pc.close();
  assert.deepEqual(errors, []);
  await b.close();
  fs.rmSync(temp, { recursive: true, force: true });
  console.log(
    "PASS v2.0 Android emulado: navegación, reloj, entrada/salida y duplicados, edición breve, incidencias, períodos, temas persistentes, JSON/CSV, concurrencia, reinicio, instalación y offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
