const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const root = require("node:path").resolve(__dirname, "..");
(async () => {
  const baseline = {};
  for (const name of execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", "8c84ab3"],
    { cwd: root, encoding: "utf8" },
  )
    .trim()
    .split("\n"))
    baseline[name] = execFileSync("git", ["show", `8c84ab3:${name}`], {
      cwd: root,
    });
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
        ? fs.readFileSync(root + "/" + name)
        : baseline[name];
      if (!content) throw Error("missing");
      res.writeHead(200, {
        "Content-Type": types[require("path").extname(name)] || "text/plain",
        "Cache-Control": "no-cache",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const url = `http://localhost:${port}/mi-control-laboral/`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext();
  let page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Aplicación en desarrollo", exact: true })
    .waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  upgraded = true;
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(
    await page.locator("nav").evaluate((el) => getComputedStyle(el).position),
    "fixed",
  );
  await page.evaluate(async () => {
    const d = await import("./js/modules/domain.js"),
      db = await import("./js/storage/db.js");
    const c = await db.getConfig();
    await db.saveRecord(
      { ...d.blank("2026-11-11", "1", c), entry: "07:30" },
      "Migración de prueba",
      0,
    );
    const reg = await navigator.serviceWorker.ready;
    await reg.update();
  });
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
  );
  await page.close();
  page = await ctx.newPage();
  await page.goto(url);
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  await page.waitForFunction(async () =>
    (await caches.keys()).some((k) => k.endsWith(":v2.0.1")),
  );
  // Esperar la activación, no solo la existencia de la caché instalada.
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return (
      !registration.waiting &&
      registration.active?.state === "activated" &&
      !(await caches.keys()).some((key) => key.endsWith(":v1"))
    );
  });
  await ctx.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Inicio", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      async () =>
        (await (await import("./js/storage/db.js")).getRecords()).length,
    ),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actualización real desde etapa 1 (SW v1), CSS/JS coherentes, activación al cerrar pestaña, conservación IndexedDB y recarga offline v2.0.1.",
  );
  await browser.close();
  await new Promise((r) => server.close(r));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
