// Prueba de actualización real: requiere el commit v1.0 e3e558e en el historial Git.
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const baselineCommit = process.env.UPGRADE_BASE || "e3e558e";
const baselineVersion = process.env.UPGRADE_VERSION || "V1.0";
(async () => {
  const baseline = {};
  for (const name of execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", baselineCommit],
    { cwd: root, encoding: "utf8" },
  )
    .trim()
    .split("\n"))
    baseline[name] = execFileSync(
      "git",
      ["show", `${baselineCommit}:${name}`],
      {
        cwd: root,
      },
    );
  let upgraded = false;
  const types = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".webmanifest": "application/manifest+json",
    ".html": "text/html",
  };
  const server = http.createServer((req, res) => {
    let name = new URL(req.url, "http://localhost").pathname.replace(
      /^\/mi-control-laboral\//,
      "",
    );
    if (!name) name = "index.html";
    try {
      const content = upgraded
        ? fs.readFileSync(path.join(root, name))
        : baseline[name];
      if (!content) throw Error("missing");
      res.writeHead(200, {
        "Content-Type": types[path.extname(name)] || "text/plain",
        "Cache-Control": "no-cache",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://localhost:${server.address().port}/mi-control-laboral/`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  let page = await context.newPage();
  const waitFor = async (predicate) => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await page.evaluate(predicate)) return;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw Error("El Service Worker no completó el estado esperado");
  };
  await page.goto(url);
  await page
    .getByRole("heading", {
      name: baselineVersion === "V2.0" ? "Inicio" : "Tu jornada, a mano.",
      exact: true,
    })
    .waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await waitFor(() => !!navigator.serviceWorker.controller);
  assert.equal(await page.locator(".version").innerText(), baselineVersion);
  const old = await page.evaluate(async () => {
    const db = await import("./js/storage/db.js"),
      d = await import("./js/modules/domain.js");
    const config = await db.getConfig();
    config.startDate = "2026-10-16";
    config.holidays = ["2026-11-11"];
    await db.saveConfig(config);
    for (const [date, link, extra] of [
      [
        "2026-11-04",
        "1",
        {
          entry: "07:30",
          exit: "18:29",
          notes: "Dato sintético de v1.0",
          officialEntry: "marked",
          officialExit: "marked",
          closed: true,
          earlyState: "justified",
        },
      ],
      ["2026-11-05", "2", { entry: "09:30", lateState: "pending" }],
      ["2026-11-08", "3", { type: "vacation" }],
    ])
      await db.saveRecord(
        { ...d.blank(date, link, config), ...extra },
        "Datos v1.0",
        0,
      );
    const records = await db.getRecords();
    return {
      config,
      records,
      backup: { format: "mi-control-laboral", version: 1, config, records },
    };
  });
  upgraded = true;
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.ready).update();
  });
  await waitFor(
    async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
  );
  assert.equal(await page.locator(".version").innerText(), baselineVersion);
  await page.close();
  page = await context.newPage();
  await page.goto(url);
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(await page.locator(".version").innerText(), "V2.0");
  await waitFor(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    return (
      !registration.waiting &&
      registration.active?.state === "activated" &&
      keys.some((key) => key.endsWith(":v2.2.0")) &&
      keys.every(
        (key) =>
          !key.startsWith("mi-control-laboral:") || key.endsWith(":v2.2.0"),
      )
    );
  });
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  const current = await page.evaluate(async () => {
    const db = await import("./js/storage/db.js");
    return {
      records: await db.getRecords(),
      config: await db.getConfig(),
      version: (await db.openDB()).version,
      legacyCount: (await import("./js/modules/domain.js")).assessment(
        (await db.getRecords()).find((r) => r.link === "2"),
        await db.getConfig(),
        new Date("2026-11-15T21:00:00"),
      ).lateCount,
    };
  });
  assert.deepEqual(current.records, old.records);
  assert.deepEqual(current.config, old.config);
  assert.equal(current.version, 1);
  assert.equal(current.legacyCount, 1);
  // Importar el respaldo anterior sobre los datos existentes no los sobrescribe.
  const result = await page.evaluate(
    async (backup) =>
      (await import("./js/storage/db.js")).importBackup(backup, true),
    old.backup,
  );
  assert.deepEqual(result, { added: 0, skipped: 3 });
  assert.deepEqual(
    await page.evaluate(async () =>
      (await import("./js/storage/db.js")).getRecords(),
    ),
    old.records,
  );
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  await page.locator("#month").fill("2026-11");
  await page.locator('[data-day="2026-11-04"]').click();
  assert.equal(await page.locator("#view [data-edit]").count(), 1);
  // El mismo JSON v1.0 también se restaura en un perfil sin datos.
  const fresh = await browser.newContext();
  const p2 = await fresh.newPage();
  await p2.goto(url);
  await p2.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  const restored = await p2.evaluate(async (backup) => {
    const db = await import("./js/storage/db.js");
    const result = await db.importBackup(backup, true);
    return {
      result,
      config: await db.getConfig(),
      records: await db.getRecords(),
    };
  }, old.backup);
  assert.deepEqual(restored.result, { added: 3, skipped: 0 });
  assert.deepEqual(restored.config, old.config);
  for (const oldRow of old.records) {
    const row = restored.records.find((r) => r.id === oldRow.id);
    assert.equal(row.entry, oldRow.entry);
    assert.equal(row.exit, oldRow.exit);
    assert.equal(row.notes, oldRow.notes);
    assert.deepEqual(row.history.slice(0, -1), oldRow.history);
  }
  await fresh.close();
  await browser.close();
  await new Promise((r) => server.close(r));
  console.log(
    "PASS: versión anterior → v2.0 conserva exactamente registros, configuración, historial y DB versión 1; JSON v1.0 compatible, duplicados conservados y lectura offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
