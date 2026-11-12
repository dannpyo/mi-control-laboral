const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const base =
  process.env.TEST_URL || "http://localhost:8770/mi-control-laboral/";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await browser.newContext({
    ...devices["Pixel 7"],
    timezoneId: "America/Asuncion",
  });
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.clock.install({ time: new Date("2026-11-15T20:00:00-03:00") });
  await p.goto(base);
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      cfg = await db.getConfig();
    cfg.startDate = "2026-10-16";
    await db.saveConfig(cfg);
  });
  const dates = {
    1: ["2026-10-21", "2026-10-28", "2026-11-04"],
    2: ["2026-10-22", "2026-10-29", "2026-11-05"],
    3: ["2026-10-18", "2026-10-25", "2026-11-01"],
  };
  async function summary() {
    await p.reload();
    await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
    await p.getByRole("button", { name: "Resumen", exact: true }).click();
  }
  for (let n = 0; n <= 3; n++) {
    if (n)
      await p.evaluate(
        async ({ dates, index }) => {
          const db = await import("./js/storage/db.js"),
            d = await import("./js/modules/domain.js"),
            cfg = await db.getConfig();
          for (const l of cfg.links) {
            const start = d.minutes(l.start) + 16,
              entry =
                String(Math.floor(start / 60)).padStart(2, "0") +
                ":" +
                String(start % 60).padStart(2, "0");
            await db.saveRecord(
              { ...d.blank(dates[l.id][index], l.id, cfg), entry, exit: l.end },
              "Prueba de margen",
              0,
            );
          }
        },
        { dates, index: n - 1 },
      );
    const before = await p.evaluate(async () =>
      (await import("./js/storage/db.js")).getRecords(),
    );
    await summary();
    for (const id of ["1", "2", "3"]) {
      const card = p.locator(`[data-summary-link="${id}"]`),
        late = card.locator('[data-margin="late"]');
      assert.match(await late.innerText(), new RegExp(`${n} computable`));
      assert.match(
        await late.innerText(),
        new RegExp(`Margen: ${Math.max(0, 2 - n)}`),
      );
      assert.equal(
        await late.getAttribute("data-level"),
        n === 0 ? "green" : n === 1 ? "amber" : "red",
      );
      if (n === 2)
        assert.match(
          await late.innerText(),
          /La próxima incidencia podría generar descuento/,
        );
      if (n === 3) {
        assert.match(
          await late.innerText(),
          /Umbral de posible descuento alcanzado/,
        );
        assert.match(await card.locator(".sanction").innerText(), /1 día/);
      }
    }
    assert.deepEqual(
      await p.evaluate(async () =>
        (await import("./js/storage/db.js")).getRecords(),
      ),
      before,
    );
    await p.getByRole("button", { name: "Inicio", exact: true }).click();
    await p.locator("#quick-link").selectOption("2");
    assert.equal(await p.locator(".immediate-risk").count(), n >= 2 ? 1 : 0);
    if (n === 2) {
      await p.locator("#quick-link").selectOption("3");
      await p
        .getByRole("button", { name: "Marcar entrada", exact: true })
        .click();
      await p
        .locator(".current-period")
        .getByLabel("Tardanzas: 3", { exact: true })
        .waitFor();
      assert.match(
        await p.locator(".immediate-risk").innerText(),
        /Umbral de posible descuento alcanzado/,
      );
      const dismiss = p.getByRole("button", {
        name: "Cerrar aviso",
        exact: true,
      });
      if (await dismiss.isVisible()) await dismiss.click();
      await p
        .getByRole("button", {
          name: "Corregir o ingresar horario",
          exact: true,
        })
        .click();
      await p.getByText("Justificar / excepción", { exact: true }).click();
      await p.locator("[name=type]").selectOption("permission");
      await p
        .getByRole("button", { name: "Guardar jornada", exact: true })
        .click();
      await p.locator("#editor").waitFor({ state: "hidden" });
      assert.equal(
        await p
          .locator(".current-period")
          .getByLabel("Tardanzas: 2", { exact: true })
          .count(),
        1,
      );
    }
  }
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator("#month").fill("2026-11");
  await p.locator('[data-day="2026-11-05"]').click();
  assert.match(
    await p.locator(".day-effect").innerText(),
    /\+1 tardanza \(total 3\)/,
  );
  assert.equal(
    await p
      .locator(
        ".calendar .compact-alert,.calendar .day-effect,.calendar [data-margin]",
      )
      .count(),
    0,
  );
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=lateJustified]").check();
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.match(
    await p.locator(".day-effect").innerText(),
    /Justificada: no suma/,
  );
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.match(
    await p.locator('[data-summary-link="2"] [data-margin="late"]').innerText(),
    /2 computables.*La próxima/s,
  );
  assert.match(
    await p.locator('[data-summary-link="1"] [data-margin="late"]').innerText(),
    /3 computables/,
  );
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator("#month").fill("2026-10");
  await p.locator('[data-day="2026-10-29"]').click();
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=lateJustified]").check();
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await p.getByRole("button", { name: "Inicio", exact: true }).click();
  await p.locator("#quick-link").selectOption("2");
  assert.equal(await p.locator(".immediate-risk").count(), 0);
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator('[data-day="2026-10-22"]').click();
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=type]").selectOption("permission");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.equal(
    await p
      .locator('[data-summary-link="2"] [data-margin="late"]')
      .getAttribute("data-level"),
    "green",
  );

  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator("#month").fill("2026-11");
  await p.locator('[data-day="2026-11-05"]').click();
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=lateJustified]").uncheck();
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.equal(
    await p
      .locator('[data-summary-link="2"] [data-margin="late"]')
      .getAttribute("data-level"),
    "amber",
  );
  // Omisiones y salidas: límites 0/1/2/3 en cada vínculo, sin modificar el motor de cálculo.
  await p.evaluate(async () => {
    const db = await import("./js/storage/db.js");
    const snap = await db.getSnapshot();
    await db.clearAllRecords(snap.revision, snap.records.length);
  });
  for (let n = 0; n <= 3; n++) {
    if (n)
      await p.evaluate(
        async ({ dates, index }) => {
          const db = await import("./js/storage/db.js"),
            d = await import("./js/modules/domain.js"),
            cfg = await db.getConfig();
          for (const l of cfg.links) {
            const end = d.minutes(l.end) - 1,
              exit =
                String(Math.floor(end / 60)).padStart(2, "0") +
                ":" +
                String(end % 60).padStart(2, "0");
            await db.saveRecord(
              { ...d.blank(dates[l.id][index], l.id, cfg), exit },
              "Omisión/salida de prueba",
              0,
            );
          }
        },
        { dates, index: n - 1 },
      );
    await summary();
    for (const id of ["1", "2", "3"]) {
      const card = p.locator(`[data-summary-link="${id}"]`);
      assert.match(
        await card.locator('[data-margin="omission"]').innerText(),
        new RegExp(`Margen: ${Math.max(0, 1 - n)}`),
      );
      assert.equal(
        await card
          .locator('[data-margin="omission"]')
          .getAttribute("data-level"),
        n === 0 ? "amber" : "red",
      );
      assert.equal(
        await card.locator('[data-margin="early"]').getAttribute("data-level"),
        n === 0 ? "green" : n === 1 ? "amber" : "red",
      );
      if (n === 1)
        assert.match(
          await card.locator('[data-margin="omission"]').innerText(),
          /La próxima incidencia/,
        );
      if (n >= 2)
        assert.match(
          await card.locator('[data-margin="omission"]').innerText(),
          /Umbral de posible descuento alcanzado/,
        );
    }
  }
  // Registrar una nueva marcación recalcula el margen al instante (quita una omisión).
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator("#month").fill("2026-11");
  await p.locator('[data-day="2026-11-05"]').click();
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.locator("[name=entry]").fill("07:30");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.match(
    await p
      .locator('[data-summary-link="2"] [data-margin="omission"]')
      .innerText(),
    /2 computables/,
  );
  for (const width of [320, 390, 1440]) {
    await p.setViewportSize({ width, height: 844 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  await p
    .getByRole("button", { name: "Cambiar a modo claro", exact: true })
    .click();
  assert.equal(await p.locator("html").getAttribute("data-theme"), "light");
  assert.equal(
    await p
      .locator('[data-summary-link="2"] [data-margin="omission"]')
      .getAttribute("data-level"),
    "red",
  );
  if (process.env.SCREENSHOT_PATH)
    await p.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
  await p.clock.setFixedTime(new Date("2026-11-16T00:00:00-03:00"));
  await p.clock.runFor(1100);
  for (const id of ["1", "2", "3"]) {
    assert.match(
      await p
        .locator(`[data-summary-link="${id}"] [data-margin="late"]`)
        .innerText(),
      /Margen: 2/,
    );
    assert.match(
      await p
        .locator(`[data-summary-link="${id}"] [data-margin="omission"]`)
        .innerText(),
      /Margen: 1/,
    );
  }
  const rows = await p.evaluate(async () =>
    (await import("./js/storage/db.js")).getRecords(),
  );
  assert.equal(rows.length, 9);
  await c.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  assert.match(
    await p.locator('[data-summary-link="2"] [data-margin="late"]').innerText(),
    /Margen: 2/,
  );
  assert.deepEqual(
    await p.evaluate(async () =>
      (await import("./js/storage/db.js")).getRecords(),
    ),
    rows,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS márgenes: 0/1/2/3 en tres vínculos y categorías, advertencias precisas, justificaciones/excepciones/edición, efecto calendario sin alertas en celdas, modos y tamaños, día 16, datos intactos y offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
