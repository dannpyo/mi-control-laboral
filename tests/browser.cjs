const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "control-laboral-test-"));
const baseURL =
  process.env.TEST_URL || "http://localhost:8765/mi-control-laboral/";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Asuncion",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-11-12T12:00:00-03:00") });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("dialog", (d) => d.accept());
  await page.goto(baseURL);
  await page.getByRole("heading", { name: "Tu jornada, a mano." }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page
    .getByRole("button", { name: "Ingreso manual / otra fecha", exact: true })
    .click();
  await page.locator("#edit-date").fill("2026-11-11");
  await page.locator("[name=entry]").fill("07:46");
  await page.locator("[name=exit]").fill("19:00");
  await page.locator("[name=lateState]").selectOption("unjustified");
  await page.locator("[name=earlyState]").selectOption("justified");
  await page.locator("[name=officialEntry]").selectOption("missing");
  await page.locator("[name=officialExit]").selectOption("marked");
  await page.locator("[name=closed]").check();
  await page
    .locator("[name=notes]")
    .fill("<script>alert(1)</script> Nota de prueba");
  await page
    .getByRole("button", { name: "Guardar jornada", exact: true })
    .click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  let rs = await page.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rs.length, 1);
  assert.equal(rs[0].entry, "07:46");
  assert.equal(rs[0].history.length, 1);
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.locator("#filter-date").fill("2026-11-12");
  let cards = page.locator(".card");
  assert.match(await cards.first().innerText(), /Tardanzas: 1/);
  assert.match(await cards.first().innerText(), /Omisiones oficiales: 1/);
  assert.match(await cards.nth(1).innerText(), /Tardanzas: 0/);
  await page.locator("#filter-date").fill("2026-11-16");
  assert.match(await page.locator(".card").first().innerText(), /Tardanzas: 0/);
  await page.locator("#filter-date").fill("2026-11-12");
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver / editar jornada", exact: true })
    .click();
  await page.locator("[name=entry]").fill("07:45");
  await page.locator("[name=notes]").fill("Corrección documentada");
  await page
    .getByRole("button", { name: "Guardar jornada", exact: true })
    .click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  rs = await page.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rs[0].history.length, 2);
  assert.equal(rs[0].history[1].before.entry, "07:46");
  assert.equal(rs[0].history[1].after.entry, "07:45");
  await page.reload();
  await page.getByRole("heading", { name: "Tu jornada, a mano." }).waitFor();
  rs = await page.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rs[0].entry, "07:45");
  await page.locator("#quick-link").selectOption("2");
  await page
    .getByRole("button", { name: "Marcar entrada", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Marcación personal guardada" })
    .waitFor();
  rs = await page.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rs.length, 2);
  assert.equal(rs.find((r) => r.link === "2").entry, "12:00");
  assert.equal(rs.find((r) => r.link === "2").officialEntry, "pending");
  await page
    .getByRole("button", { name: "Marcar entrada", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Ya hay entrada personal" })
    .waitFor();
  await page.clock.setFixedTime(new Date("2026-11-12T20:00:00-03:00"));
  await page
    .getByRole("button", { name: "Marcar salida", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Marcación personal guardada" })
    .waitFor();
  rs = await page.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rs.find((r) => r.link === "2").exit, "20:00");
  assert.equal(rs.find((r) => r.link === "2").officialExit, "pending");
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.locator("[name=holidays]").fill("2026-11-18");
  await page
    .getByRole("button", { name: "Guardar configuración", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Configuración guardada" })
    .waitFor();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  await page.locator('[data-day="2026-11-18"]').click();
  await page.locator('[data-edit="1"]').click();
  assert.equal(await page.locator("[name=type]").inputValue(), "holiday-free");
  await page.locator("[name=type]").selectOption("holiday-work");
  await page.locator("[name=entry]").fill("08:31");
  await page.locator("[name=rain]").check();
  await page.locator("[name=lateState]").selectOption("unjustified");
  await page
    .getByRole("button", { name: "Guardar jornada", exact: true })
    .click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  let d = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar JSON", exact: true })
    .click();
  const json = await d;
  await json.saveAs(path.join(scratch, "v1-backup-test.json"));
  let backup = JSON.parse(
    require("fs").readFileSync(path.join(scratch, "v1-backup-test.json")),
  );
  assert.equal(backup.records.length, 3);
  d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  const csv = await d;
  await csv.saveAs(path.join(scratch, "v1-export-test.csv"));
  assert.match(
    require("fs").readFileSync(
      path.join(scratch, "v1-export-test.csv"),
      "utf8",
    ),
    /Corrección documentada/,
  );
  await page
    .locator("#json-import")
    .setInputFiles(path.join(scratch, "v1-backup-test.json"));
  await page
    .getByRole("status")
    .filter({ hasText: "0 nuevas; 3 coincidentes conservadas" })
    .waitFor();
  const dbChecks = await page.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      domain = await import("./js/modules/domain.js");
    const config = await db.getConfig();
    let rows = await db.getRecords();
    let duplicate = false;
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
    const invalid = structuredClone(rows[0]);
    invalid.date = "incorrecta";
    let rejected = false;
    try {
      await db.importBackup({
        format: "mi-control-laboral",
        version: 1,
        config,
        records: [domain.blank("2026-10-21", "1", config), invalid],
      });
    } catch {
      rejected = true;
    }
    const r = rows[0];
    await db.saveRecord(
      { ...r, notes: "Nueva versión" },
      "Prueba de concurrencia",
      r.revision,
    );
    let stale = false;
    try {
      await db.saveRecord(
        { ...r, notes: "Obsoleta" },
        "Versión obsoleta",
        r.revision,
      );
    } catch {
      stale = true;
    }
    return {
      duplicate,
      rejected,
      stale,
      count: (await db.getRecords()).length,
    };
  });
  assert.deepEqual(dbChecks, {
    duplicate: true,
    rejected: true,
    stale: true,
    count: 3,
  });
  // Restauración en otra base (perfil limpio) y persistencia tras cerrar contexto.
  const fresh = await browser.newContext();
  const p2 = await fresh.newPage();
  await p2.goto(baseURL);
  await p2.getByRole("heading", { name: "Tu jornada, a mano." }).waitFor();
  const result = await p2.evaluate(
    async (backup) => (await import("./js/storage/db.js")).importBackup(backup),
    backup,
  );
  assert.equal(result.added, 3);
  await p2.reload();
  await p2.getByRole("heading", { name: "Tu jornada, a mano." }).waitFor();
  assert.equal(
    await p2.evaluate(
      async () =>
        (await (await import("./js/storage/db.js")).getRecords()).length,
    ),
    3,
  );
  await fresh.close();
  // Persistencia tras cerrar realmente el navegador y restaurar configuración.
  const profile = path.join(scratch, "profile");
  const launch = {
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  };
  let persistent = await chromium.launchPersistentContext(profile, launch);
  let persistPage = await persistent.newPage();
  await persistPage.goto(baseURL);
  await persistPage
    .getByRole("heading", { name: "Tu jornada, a mano." })
    .waitFor();
  await persistPage.evaluate(async (backup) => {
    const db = await import("./js/storage/db.js");
    await db.importBackup(backup, true);
  }, backup);
  await persistent.close();
  persistent = await chromium.launchPersistentContext(profile, launch);
  persistPage = await persistent.newPage();
  await persistPage.goto(baseURL);
  await persistPage
    .getByRole("heading", { name: "Tu jornada, a mano." })
    .waitFor();
  const persisted = await persistPage.evaluate(async () => {
    const db = await import("./js/storage/db.js");
    return {
      count: (await db.getRecords()).length,
      config: await db.getConfig(),
    };
  });
  assert.equal(persisted.count, 3);
  assert.deepEqual(persisted.config, backup.config);
  const cdp = await persistent.newCDPSession(persistPage);
  assert.deepEqual((await cdp.send("Page.getAppManifest")).errors, []);
  assert.deepEqual(
    (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
    [],
  );
  await persistent.close();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Tu jornada, a mano." }).waitFor();
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await page.locator("#filter-date").fill("2026-11-12");
  await page.locator('[data-edit="1"]').click();
  await page.locator("[name=notes]").fill("Edición offline");
  await page
    .getByRole("button", { name: "Guardar jornada", exact: true })
    .click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  await page.reload();
  await page.getByRole("heading", { name: "Tu jornada, a mano." }).waitFor();
  assert.equal(
    (
      await page.evaluate(async () =>
        (await (await import("./js/storage/db.js")).getRecords()).find(
          (r) => r.link === "1" && r.date === "2026-11-11",
        ),
      )
    ).notes,
    "Edición offline",
  );
  for (const name of [
    "Inicio",
    "Calendario",
    "Resumen",
    "Historial",
    "Configuración",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `overflow ${name}`,
    );
  }
  await page.screenshot({
    path: path.join(scratch, "v1-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Inicio", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(scratch, "v1-desktop.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: UI manual, edición y auditoría, marcación rápida, duplicados, filtros, feriados, exportación JSON/CSV, importación y validación atómica, concurrencia, persistencia, offline y cinco secciones sin desbordamiento.",
  );
  await browser.close();
  fs.rmSync(scratch, { recursive: true, force: true });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
