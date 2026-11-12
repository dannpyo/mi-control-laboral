import test from "node:test";
import assert from "node:assert/strict";
import { incidenceMargin } from "../js/modules/margins.js";
import { fine, defaults, blank, stats, period } from "../js/modules/domain.js";
test("tardanzas y salidas: 0→2, 1→1, 2→0 próxima, 3+ umbral alcanzado", () => {
  for (const type of ["late", "early"])
    for (const [n, remaining, level, reached] of [
      [0, 2, "green", false],
      [1, 1, "amber", false],
      [2, 0, "red", false],
      [3, 0, "red", true],
      [7, 0, "red", true],
    ]) {
      const m = incidenceMargin(n, type);
      assert.equal(m.remaining, remaining);
      assert.equal(m.level, level);
      assert.equal(m.reached, reached);
      assert.equal(m.threshold, 3);
      assert.equal(m.reached, fine(n, type) > 0);
    }
});
test("omisiones: 0→1 ámbar, 1→0 próxima, 2+ umbral alcanzado", () => {
  for (const [n, remaining, level, reached] of [
    [0, 1, "amber", false],
    [1, 0, "red", false],
    [2, 0, "red", true],
    [6, 0, "red", true],
  ]) {
    const m = incidenceMargin(n, "omission");
    assert.equal(m.remaining, remaining);
    assert.equal(m.level, level);
    assert.equal(m.reached, reached);
    assert.equal(m.threshold, 2);
  }
});
test("mensajes distinguen la próxima incidencia del umbral ya alcanzado, sin afirmar multa aplicada", () => {
  assert.equal(incidenceMargin(0, "late").message, "");
  assert.equal(
    incidenceMargin(2, "late").message,
    "La próxima incidencia podría generar descuento",
  );
  assert.equal(
    incidenceMargin(3, "late").message,
    "Umbral de posible descuento alcanzado",
  );
  assert.equal(
    incidenceMargin(1, "omission").message,
    "La próxima incidencia podría generar descuento",
  );
  assert.throws(() => incidenceMargin(-1, "late"));
  assert.throws(() => incidenceMargin(1.2, "early"));
  assert.throws(() => incidenceMargin(1, "other"));
});
test("solo contadores computables: justificación, vínculo y período respetan el cálculo existente", () => {
  const c = { ...defaults(), startDate: "2026-10-16" },
    now = new Date("2026-11-15T20:00:00");
  const records = [
    {
      ...blank("2026-10-29", "2", c),
      entry: "08:08",
      lateState: "justified",
      omissionJustified: true,
    },
    { ...blank("2026-11-12", "2", c), entry: "08:00", exit: "19:30" },
  ];
  const before = JSON.stringify(records),
    p = period("2026-11-12"),
    s = stats(records, c, "2", p, now);
  assert.equal(s.lateDetected, 2);
  assert.equal(s.late, 1);
  assert.equal(s.omissions, 0);
  assert.equal(incidenceMargin(s.late, "late").remaining, 1);
  assert.equal(incidenceMargin(s.omissions, "omission").remaining, 1);
  assert.equal(
    incidenceMargin(stats(records, c, "1", p, now).late, "late").remaining,
    2,
  );
  assert.equal(
    incidenceMargin(
      stats(records, c, "2", period("2026-11-16"), now).late,
      "late",
    ).remaining,
    2,
  );
  assert.equal(JSON.stringify(records), before);
});
