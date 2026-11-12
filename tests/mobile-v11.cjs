const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Asuncion",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.clock.install({ time: new Date("2026-11-15T21:00:00-03:00") });
  await page.goto(
    process.env.TEST_URL || "http://localhost:8766/mi-control-laboral/",
  );
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  for (const [date, links] of [
    ["2026-11-04", ["1"]],
    ["2026-11-05", ["2"]],
    ["2026-11-08", ["3"]],
    ["2026-11-09", []],
  ]) {
    await page.locator(`[data-day="${date}"]`).click();
    assert.deepEqual(
      await page
        .locator("#view [data-edit]")
        .evaluateAll((bs) => bs.map((b) => b.dataset.edit)),
      links,
    );
    if (!links.length)
      assert.equal(
        await page.locator(`[data-day="${date}"] .link-marker`).count(),
        0,
      );
  }
  await page.locator('[data-day="2026-11-04"]').click();
  await page
    .getByRole("button", { name: "Registrar jornada excepcional", exact: true })
    .click();
  await page.locator("#exceptional-link").selectOption("2");
  await page
    .getByRole("button", { name: "Abrir jornada seleccionada", exact: true })
    .click();
  await page.locator("[name=entry]").fill("07:30");
  await page.locator("[name=exit]").fill("18:29");
  await page.getByText("Más opciones", { exact: true }).click();
  await page.locator("[name=earlyState]").selectOption("justified");
  await page.locator("[name=officialEntry]").selectOption("marked");
  await page.locator("[name=officialExit]").selectOption("marked");
  await page.locator("[name=closed]").check();
  await page
    .getByRole("button", { name: "Guardar jornada", exact: true })
    .click();
  await page.locator("#editor").waitFor({ state: "hidden" });
  assert.deepEqual(
    await page
      .locator("#view [data-edit]")
      .evaluateAll((bs) => bs.map((b) => b.dataset.edit)),
    ["1", "2"],
  );
  assert.equal(
    await page.locator('[data-day="2026-11-04"] .link-marker').count(),
    2,
  );
  assert.equal(
    await page
      .locator('[data-day="2026-11-04"] .validated[data-link="2"]')
      .count(),
    1,
  );
  assert.match(await page.locator("#view").innerText(), /Jornada excepcional/);
  await page.locator("#calendar-link").selectOption("2");
  assert.deepEqual(
    await page
      .locator("#view [data-edit]")
      .evaluateAll((bs) => bs.map((b) => b.dataset.edit)),
    ["2"],
  );
  await page.locator("#calendar-link").selectOption("3");
  assert.equal(await page.locator("#view [data-edit]").count(), 0);
  await page.locator("#calendar-link").selectOption("all");
  await page.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const c = await db.getConfig();
    c.startDate = "2026-11-01";
    c.holidays = ["2026-11-11"];
    await db.saveConfig(c);
    for (const [date, link, extra] of [
      ["2026-11-05", "2", {}],
      ["2026-11-08", "3", { type: "permission" }],
      [
        "2026-11-12",
        "2",
        {
          entry: "08:00",
          exit: "19:30",
          lateState: "unjustified",
          closed: true,
          officialEntry: "marked",
          officialExit: "marked",
        },
      ],
      ["2026-11-01", "3", { entry: "08:00", lateState: "unjustified" }],
      ["2026-10-25", "3", { entry: "08:00", lateState: "unjustified" }],
    ])
      await db.saveRecord(
        { ...d.blank(date, link, c), ...extra },
        "Datos sintéticos",
        0,
      );
  });
  // Recarga únicamente de interfaz: no debe reescribir los registros existentes.
  const before = await page.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  assert.equal(
    await page
      .locator('[data-day="2026-11-11"] .special[data-link="1"]')
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator('[data-day="2026-11-08"] .special[data-link="3"]')
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator('[data-day="2026-11-12"] .incident[data-link="2"]')
      .count(),
    1,
  );
  assert.equal(
    await page
      .locator('[data-day="2026-11-05"] .review[data-link="2"]')
      .count(),
    1,
  );
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.equal(await page.locator(".summary-card").count(), 3);
  assert.equal(
    await page.locator('[data-summary-link="3"] .preventive').count(),
    1,
  );
  const link2 = page.locator('[data-summary-link="2"]');
  assert.equal(await link2.locator("details").getAttribute("open"), null);
  assert.doesNotMatch(await link2.innerText(), /Estimación: 0 días/);
  await link2.locator("summary").click();
  assert.match(await link2.innerText(), /12\/11\/2026.*Tardanza/);
  assert.doesNotMatch(await link2.innerText(), /estadísticas completas/);
  await page.locator("#filter-link").selectOption("2");
  assert.equal(await page.locator(".summary-card").count(), 1);
  await page
    .getByRole("button", { name: "Período siguiente", exact: true })
    .click();
  assert.match(
    await page.locator(".period-picker").innerText(),
    /16\/11\/2026/,
  );
  assert.equal(
    await page
      .locator('[data-summary-link="2"]')
      .getByLabel("Tardanzas: 0", { exact: true })
      .count(),
    1,
  );
  await page
    .getByRole("button", { name: "Período anterior", exact: true })
    .click();
  assert.equal(
    await page
      .locator('[data-summary-link="2"]')
      .getByLabel("Tardanzas: 1", { exact: true })
      .count(),
    1,
  );
  assert.deepEqual(
    await page.evaluate(async () =>
      (await import("./js/storage/db.js")).getRecords(),
    ),
    before,
  );
  await page.locator("#filter-link").selectOption("all");
  // Al tercer caso se pasa de la alerta preventiva al umbral informativo de sanción.
  await page.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const c = await db.getConfig();
    await db.saveRecord(
      {
        ...d.blank("2026-11-15", "3", c),
        entry: "08:00",
        lateState: "unjustified",
      },
      "Tercera incidencia sintética",
      0,
    );
  });
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.equal(
    await page.locator('[data-summary-link="3"] .sanction').count(),
    1,
  );
  assert.match(
    await page.locator('[data-summary-link="3"] .sanction').innerText(),
    /1 día/,
  );
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole("button", { name: "Calendario", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole("button", { name: "Resumen", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path:
      process.env.SCREENSHOT_PATH ||
      path.join(os.tmpdir(), "mi-control-laboral-v11.png"),
    fullPage: true,
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  await page.locator('[data-day="2026-11-04"]').click();
  assert.equal(await page.locator("#view [data-edit]").count(), 2);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS regresión calendario v2.0: días y filtros, excepción, indicadores diferenciados, resumen compacto y fechas desplegables, períodos, lectura sin mutaciones, 320–1440 px y offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
