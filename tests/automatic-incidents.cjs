const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({
    ...devices["Pixel 7"],
    timezoneId: "America/Asuncion",
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.clock.install({ time: new Date("2026-11-12T20:00:00-03:00") });
  await p.goto(
    process.env.TEST_URL || "http://localhost:8766/mi-control-laboral/",
  );
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p
    .getByRole("button", { name: "Corregir o ingresar horario", exact: true })
    .click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  assert.equal(
    await p
      .getByText("Llegada tardía justificada", { exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await p
      .getByText("Salida anticipada justificada", { exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await p.locator("select[name=lateState],select[name=earlyState]").count(),
    0,
  );
  await p.locator("[name=entry]").fill("09:30");
  await p.locator("[name=exit]").fill("19:31");
  assert.equal(
    await p
      .getByText("Llegada tardía justificada", { exact: true })
      .isVisible(),
    true,
  );
  assert.equal(await p.locator("[name=lateJustified]").isChecked(), false);
  assert.equal(
    await p
      .getByText("Salida anticipada justificada", { exact: true })
      .isVisible(),
    true,
  );
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.match(
    await p.locator(".punch-card .status").innerText(),
    /Llegada tardía · 120 min de retraso/,
  );
  assert.doesNotMatch(
    await p.locator(".punch-card .status").innerText(),
    /por revisar/i,
  );
  assert.equal(
    await p
      .locator(".current-period")
      .getByLabel("Tardanzas: 1", { exact: true })
      .count(),
    1,
  );
  let saved = await p.evaluate(
    async () => (await (await import("./js/storage/db.js")).getRecords())[0],
  );
  assert.equal(saved.officialEntry, "pending");
  assert.equal(saved.history.length, 1);
  await p.getByRole("button", { name: "Resumen", exact: true }).click();
  let card = p.locator('[data-summary-link="2"]');
  await card.locator("summary").click();
  assert.match(
    await card.innerText(),
    /1 detectadas · 0 justificadas · 1 computables/,
  );
  assert.match(await card.locator(".incident-dates").innerText(), /120 min/);
  await card.locator("[data-edit]").click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=lateJustified]").check();
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await card.getByLabel("Tardanzas: 0", { exact: true }).count(),
    1,
  );
  await card.locator("summary").click();
  assert.match(
    await card.innerText(),
    /1 detectadas · 1 justificadas · 0 computables/,
  );
  assert.match(
    await card.locator(".incident-dates").innerText(),
    /Llegada tardía.*120 min.*justificada/,
  );
  await card.locator("[data-edit]").click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  assert.equal(await p.locator("[name=lateJustified]").isChecked(), true);
  await p.locator("[name=lateJustified]").uncheck();
  await p.locator("[name=exit]").fill("19:00");
  assert.equal(await p.locator("[name=earlyJustified]").isVisible(), true);
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await card.getByLabel("Tardanzas: 1", { exact: true }).count(),
    1,
  );
  assert.equal(
    await card.getByLabel("Salidas anticipadas: 1", { exact: true }).count(),
    1,
  );
  await card.locator("summary").click();
  await card.locator("[data-edit]").click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=earlyJustified]").check();
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await card.getByLabel("Salidas anticipadas: 0", { exact: true }).count(),
    1,
  );
  await card.locator("summary").click();
  assert.match(
    await card.innerText(),
    /Salidas anticipadas: 1 detectadas · 1 justificadas · 0 computables/,
  );
  // Visibilidad responde a lluvia y límites sin escribir cambios al mover controles.
  await card.locator("[data-edit]").click();
  await p.getByText("Justificar / excepción", { exact: true }).click();
  await p.locator("[name=entry]").fill("08:30");
  await p.locator("[name=rain]").check();
  assert.equal(await p.locator("[name=lateJustified]").isVisible(), true);
  await p.locator("[name=entry]").fill("08:31");
  assert.equal(await p.locator("[name=lateJustified]").isVisible(), true);
  await p.getByRole("button", { name: "Cerrar editor", exact: true }).click();
  // Importación antigua con justificación conserva bytes laborales y audita nuevos cambios.
  saved = await p.evaluate(
    async () => (await (await import("./js/storage/db.js")).getRecords())[0],
  );
  assert.equal(saved.history.length, 4);
  assert.equal(saved.history[0].after.lateState, "unjustified");
  assert.equal(saved.history[1].after.lateState, "justified");
  assert.equal(saved.history[2].after.lateState, "unjustified");
  assert.equal(saved.history[3].after.earlyState, "justified");
  await p.getByRole("button", { name: "Calendario", exact: true }).click();
  await p.locator('[data-day="2026-11-12"]').click();
  assert.equal(
    await p.locator('[data-day="2026-11-12"] .incident[data-link="2"]').count(),
    1,
  );
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.locator("[name=entry]").fill("");
  await p.locator("[name=exit]").fill("");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await p.locator(".record-card .status").innerText(),
    "Posible ausencia",
  );
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.locator("[name=entry]").fill("07:30");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await p.locator(".record-card .status").innerText(),
    "Falta salida · 1 omisión(es) de marcación",
  );
  await p.getByRole("button", { name: "Editar", exact: true }).click();
  await p.locator("[name=entry]").fill("");
  await p.locator("[name=exit]").fill("19:30");
  await p.getByRole("button", { name: "Guardar jornada", exact: true }).click();
  await p.locator("#editor").waitFor({ state: "hidden" });
  assert.equal(
    await p.locator(".record-card .status").innerText(),
    "Falta entrada · 1 omisión(es) de marcación",
  );
  await c.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(
    await p
      .locator(".current-period")
      .getByLabel("Omisiones de marcación: 1", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await p.locator(".punch-card .status").innerText(),
    "Falta entrada · 1 omisión(es) de marcación",
  );
  assert.deepEqual(errors, []);
  await b.close();
  console.log(
    "PASS automático: 120 min, checkboxes condicionales, justificar/desjustificar, totales detectados/justificados/computables, calendario, historial íntegro, límites lluvia, incompletos con omisiones tras salida y offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
