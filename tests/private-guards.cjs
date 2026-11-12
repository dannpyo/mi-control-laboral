// Datos sintéticos y perfiles temporales; nunca usa registros personales.
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const base =
  process.env.TEST_URL || "http://localhost:8771/mi-control-laboral/";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    timezoneId: "America/Asuncion",
    locale: "es-PY",
    acceptDownloads: true,
  });
  const p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let accept = true,
    confirmations = 0;
  p.on("dialog", async (d) => {
    confirmations++;
    if (accept) await d.accept();
    else await d.dismiss();
  });
  await p.clock.install({ time: new Date("2026-11-12T12:00:00-03:00") });
  const wait = async (predicate) => {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      if (await p.evaluate(predicate)) return;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw Error("Estado no alcanzado");
  };
  const state = () =>
    p.evaluate(async () =>
      (await import("./js/storage/db.js")).getPrivateGuards(),
    );
  const nav = async () => {
    await p
      .getByRole("button", { name: "Guardias privadas", exact: true })
      .click();
    await p.locator("#private-add").waitFor();
  };
  const closeNotice = async () => {
    const b = p.getByRole("button", { name: "Cerrar aviso", exact: true });
    if (await b.isVisible()) await b.click();
  };
  const add = async (start, end) => {
    await p.locator("#private-add").click();
    await p.locator("[name=private-start]").fill(start);
    await p.locator("[name=private-end]").fill(end);
    await p.locator("#private-form [type=submit]").click();
    await p.locator(".private-dialog").waitFor({ state: "detached" });
    await closeNotice();
  };
  await p.goto(base);
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await wait(() => !!navigator.serviceWorker.controller);
  const labor = await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js"),
      config = await db.getConfig();
    const record = await db.saveRecord(
      {
        ...d.blank("2026-11-12", "2", config),
        entry: "08:08",
        exit: "19:30",
        notes: "Sintético para conservación",
      },
      "Prueba sintética",
      0,
    );
    return { records: await db.getRecords(), config };
  });
  await nav();
  assert.equal(await state(), undefined);
  assert.match(await p.locator(".private-amount").innerText(), /0/);
  await add("2026-12-05T19:00", "2026-12-06T07:00");
  assert.match(await p.locator(".private-amount").innerText(), /247\.500/);
  assert.match(
    await p.locator(".private-row").innerText(),
    /5 h 00 min.*este período/,
  );
  let data = await state();
  assert.equal(data.shifts.length, 1);
  const id = data.shifts[0].id;
  await p.locator("#private-next").click();
  await p.locator(".private-amount").filter({ hasText: "346.500" }).waitFor();
  assert.equal(
    await p.locator(".private-row").getAttribute("data-private-id"),
    id,
  );
  assert.match(await p.locator(".private-row").innerText(), /7 h 00 min/);
  // Cambiar tarifas futuras no toca la guardia registrada.
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  await p
    .getByText("Guardias privadas · tarifas y liquidación", { exact: true })
    .click();
  await p.locator("[name=normal-rate]").fill("50000");
  await p.locator("[name=weekend-rate]").fill("60000");
  await p
    .getByRole("button", { name: "Guardar ajustes privados", exact: true })
    .click();
  await wait(
    async () =>
      (await (await import("./js/storage/db.js")).getPrivateGuards()).config
        .rates.weekend === 60000,
  );
  assert.equal((await state()).shifts[0].rates.weekend, 49500);
  await closeNotice();
  await nav();
  await p.getByRole("button", { name: "Editar guardia", exact: true }).click();
  await p.locator("[name=private-end]").fill("2026-12-06T08:00");
  await p.locator("#private-form [type=submit]").click();
  await p.locator(".private-dialog").waitFor({ state: "detached" });
  await closeNotice();
  assert.equal((await state()).shifts[0].rates.weekend, 49500);
  await p.getByRole("button", { name: "Editar guardia", exact: true }).click();
  await p.locator("#private-rerate").click();
  await p.locator("#private-form [type=submit]").click();
  await p.locator(".private-dialog").waitFor({ state: "detached" });
  await closeNotice();
  data = await state();
  assert.equal(data.shifts.length, 1);
  assert.equal(data.shifts[0].rates.weekend, 60000);
  assert.ok(data.shifts[0].history.some((h) => h.action.includes("Recálculo")));
  // Límites y factura individuales; una cancelación conserva el período.
  await p.locator("#private-period-edit").click();
  await p.locator("[name=period-end]").fill("2026-12-06T01:00");
  await p.locator("[name=bill-from]").fill("2026-12-12");
  await p.locator("[name=bill-to]").fill("2026-12-20");
  accept = false;
  await p.locator("#private-form [type=submit]").click();
  assert.equal(await p.locator(".private-dialog").isVisible(), true);
  assert.deepEqual((await state()).periods, data.periods);
  accept = true;
  await p.locator("#private-form [type=submit]").click();
  await p.locator(".private-dialog").waitFor({ state: "detached" });
  await closeNotice();
  data = await state();
  const changed = data.periods.find((q) => q.end === "2026-12-06T01:00");
  assert.ok(changed);
  assert.equal(changed.billing.to, "2026-12-20");
  assert.equal(
    data.periods[data.periods.indexOf(changed) + 1].start,
    changed.end,
  );
  assert.match(await p.locator(".private-amount").innerText(), /360\.000/);
  // Borrado de guardia: cancelar, confirmar, y eliminar aportes de ambos períodos.
  accept = false;
  await p
    .getByRole("button", { name: "Eliminar guardia", exact: true })
    .click();
  assert.equal((await state()).shifts.length, 1);
  accept = true;
  await p
    .getByRole("button", { name: "Eliminar guardia", exact: true })
    .click();
  await wait(
    async () =>
      !(await (await import("./js/storage/db.js")).getPrivateGuards()).shifts
        .length,
  );
  await closeNotice();
  assert.match(await p.locator(".private-amount").innerText(), /0/);
  await p.locator("#private-next").click();
  await p
    .getByText("Sin guardias registradas en esta liquidación.", { exact: true })
    .waitFor();
  await add("2026-12-05T19:00", "2026-12-06T07:00");
  // Error de salida inválida y duplicado sin cambios.
  await p.locator("#private-add").click();
  await p.locator("[name=private-start]").fill("2026-12-05T19:00");
  await p.locator("[name=private-end]").fill("2026-12-05T18:00");
  await p.locator("#private-form [type=submit]").click();
  await p.locator("#private-error").waitFor();
  assert.equal((await state()).shifts.length, 1);
  await p.locator("[name=private-end]").fill("2026-12-06T07:00");
  await p.locator("#private-form [type=submit]").click();
  await p
    .getByText("Ya existe una guardia con esas fechas y horas", { exact: true })
    .waitFor();
  await p.locator("#private-cancel").click();
  // Respaldos nuevos, antiguos, exclusión explícita y transacción atómica ante conflicto.
  const backup = await p.evaluate(async () =>
    (await import("./js/data/manager.js")).backupDocument(
      await (await import("./js/storage/db.js")).getSnapshot(),
    ),
  );
  assert.equal(backup.records.length, 1);
  assert.equal(backup.privateGuards.shifts.length, 1);
  const checks = await p.evaluate(async (backup) => {
    const db = await import("./js/storage/db.js"),
      pd = await import("./js/private/domain.js"),
      wd = await import("./js/modules/domain.js");
    const before = await db.getPrivateGuards(),
      { privateGuards, ...old } = backup;
    await db.importBackup(old, true);
    const oldPreserved =
      JSON.stringify(await db.getPrivateGuards()) === JSON.stringify(before);
    await db.importBackup(backup, false, false);
    const uncheckedPreserved =
      JSON.stringify(await db.getPrivateGuards()) === JSON.stringify(before);
    const row = wd.blank("2026-11-19", "2", backup.config),
      conflict = structuredClone(backup);
    conflict.records.push(row);
    const target = conflict.privateGuards.periods.find(
      (q) => q.end === "2026-12-06T01:00",
    );
    conflict.privateGuards = pd.editPeriod(
      conflict.privateGuards,
      target.id,
      {
        start: target.start,
        end: "2026-12-06T02:00",
        billFrom: target.billing.from,
        billTo: target.billing.to,
      },
      "2026-11-12T12:00",
    ).data;
    let rejected = false;
    try {
      await db.importBackup(conflict, true);
    } catch {
      rejected = true;
    }
    const rollback =
      (await db.getRecords()).length === 1 &&
      JSON.stringify(await db.getPrivateGuards()) === JSON.stringify(before);
    let stale = false;
    await db.savePrivateGuards(before, before.revision);
    try {
      await db.savePrivateGuards(before, before.revision);
    } catch {
      stale = true;
    }
    return { oldPreserved, uncheckedPreserved, rejected, rollback, stale };
  }, backup);
  assert.deepEqual(checks, {
    oldPreserved: true,
    uncheckedPreserved: true,
    rejected: true,
    rollback: true,
    stale: true,
  });
  const restore = await browser.newContext({ timezoneId: "UTC" }),
    rp = await restore.newPage();
  await rp.goto(base);
  await rp.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await rp.evaluate(
    async (backup) =>
      (await import("./js/storage/db.js")).importBackup(backup, true),
    backup,
  );
  assert.deepEqual(
    await rp.evaluate(
      async () =>
        (await (await import("./js/storage/db.js")).getPrivateGuards()).shifts,
    ),
    backup.privateGuards.shifts,
  );
  await restore.close();
  // Exportación de interfaz incluye ambos módulos.
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  const downloaded = p.waitForEvent("download");
  await p.getByRole("button", { name: "Exportar JSON", exact: true }).click();
  const download = await downloaded;
  let json = "";
  for await (const chunk of await download.createReadStream()) json += chunk;
  assert.equal(JSON.parse(json).privateGuards.shifts.length, 1);
  await nav();
  await context.setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await nav();
  await add("2026-12-07T19:00", "2026-12-08T07:00");
  assert.equal((await state()).shifts.length, 2);
  await p.reload();
  await p.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await nav();
  assert.equal((await state()).shifts.length, 2);
  // Navegación clara/oscura y ancho 320 sin desplazamiento horizontal.
  await p
    .getByRole("button", { name: "Cambiar a modo claro", exact: true })
    .click();
  await p.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await p.locator("#private-add").click();
  assert.equal(
    await p.evaluate(
      () =>
        document.querySelector(".private-dialog").getBoundingClientRect()
          .right <= innerWidth,
    ),
    true,
  );
  await p.locator("#private-cancel").click();
  // Patrón y factura futuros desde Configuración, incluso sin conexión.
  const beforePattern = await state();
  await p.getByRole("button", { name: "Configuración", exact: true }).click();
  await p
    .getByText("Guardias privadas · tarifas y liquidación", { exact: true })
    .click();
  await p.locator("[name=cycle-day]").fill("8");
  await p.locator("[name=cycle-time]").fill("08:00");
  await p.locator("[name=bill-start]").fill("11");
  await p.locator("[name=bill-end]").fill("19");
  await p
    .getByRole("button", { name: "Guardar ajustes privados", exact: true })
    .click();
  await wait(
    async () =>
      (await (await import("./js/storage/db.js")).getPrivateGuards()).config
        .pattern.day === 8,
  );
  const afterPattern = await state();
  const historyPeriods = beforePattern.periods.filter(
    (q) => q.start <= "2026-11-12T12:00",
  );
  assert.deepEqual(
    afterPattern.periods.filter((q) => q.start <= "2026-11-12T12:00"),
    historyPeriods,
  );
  assert.deepEqual(afterPattern.shifts, beforePattern.shifts);
  const future = afterPattern.periods.find(
    (q) => q.start === "2026-12-06T01:00",
  );
  assert.equal(future.end, "2027-01-08T08:00");
  assert.deepEqual(future.billing, { from: "2027-01-11", to: "2027-01-19" });
  await closeNotice();
  const finalLabor = await p.evaluate(async () => {
    const db = await import("./js/storage/db.js");
    return { records: await db.getRecords(), config: await db.getConfig() };
  });
  assert.deepEqual(finalLabor, labor);
  // Limpieza laboral conserva guardias privadas y ajustes.
  const clear = await p.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      before = await db.getPrivateGuards(),
      snap = await db.getSnapshot();
    await db.clearAllRecords(snap.revision, snap.records.length);
    return {
      before,
      after: await db.getPrivateGuards(),
      records: await db.getRecords(),
      config: await db.getConfig(),
    };
  });
  assert.deepEqual(clear.before, clear.after);
  assert.equal(clear.records.length, 0);
  assert.deepEqual(clear.config, labor.config);
  assert.ok(confirmations >= 4);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS Guardias privadas: CRUD móvil, dos liquidaciones/un registro, tarifas y recálculo confirmado, límites/factura, cancelaciones, duplicados, JSON nuevo/antiguo, rollback y concurrencia, offline, tema/ancho320 y conservación laboral.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
