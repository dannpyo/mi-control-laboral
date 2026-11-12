import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  blank,
  assessment,
  stats,
  period,
  validateRecord,
} from "../js/modules/domain.js";
const c = defaults(),
  now = new Date("2026-11-12T20:00:00");
const example = () => ({
  ...blank("2026-11-12", "2", c),
  entry: "09:30",
  exit: "19:31",
});
test("ejemplo obligatorio: 09:30–19:31 detecta una tardanza de 120 minutos, sin salida anticipada", () => {
  const a = assessment(example(), c, now);
  assert.equal(a.late, true);
  assert.equal(a.lateMinutes, 120);
  assert.equal(a.lateCount, 1);
  assert.equal(a.lateJustified, false);
  assert.equal(a.early, false);
  assert.equal(a.earlyCount, 0);
  assert.equal(a.omissions, 0);
});
test("justificar y desjustificar recalcula, conservando incidencia detectada e historial", () => {
  const r = example();
  r.history = [
    {
      at: now.toISOString(),
      action: "Histórico",
      before: null,
      after: { entry: "09:30" },
    },
  ];
  const original = structuredClone(r);
  for (const [state, count, justified] of [
    ["justified", 0, true],
    ["unjustified", 1, false],
    ["pending", 1, false],
  ]) {
    const record = { ...r, lateState: state },
      a = assessment(record, c, now),
      s = stats([record], c, "2", period(r.date), now);
    assert.equal(a.late, true);
    assert.equal(a.lateCount, count);
    assert.equal(a.lateJustified, justified);
    assert.equal(s.lateDetected, 1);
    assert.equal(s.lateJustified, Number(justified));
    assert.equal(s.late, count);
    validateRecord(record);
  }
  assert.deepEqual(r, original);
});
test("tolerancias inclusivas, lluvia total y minutos respecto del inicio previsto", () => {
  for (const [entry, rain, detected, delay] of [
    ["07:45", false, false, 0],
    ["07:46", false, true, 16],
    ["08:30", true, false, 0],
    ["08:31", true, true, 61],
  ]) {
    const a = assessment({ ...example(), entry, rain }, c, now);
    assert.equal(a.late, detected);
    assert.equal(a.lateMinutes, delay);
    assert.equal(a.lateCount, Number(detected));
  }
});
test("salida anticipada automática y justificación independiente de tardanza", () => {
  const r = { ...example(), exit: "19:29" };
  assert.equal(assessment(r, c, now).earlyMinutes, 1);
  for (const [lateState, earlyState, lateCount, earlyCount] of [
    ["unjustified", "unjustified", 1, 1],
    ["justified", "unjustified", 0, 1],
    ["unjustified", "justified", 1, 0],
    ["justified", "justified", 0, 0],
    ["pending", "pending", 1, 1],
  ]) {
    const row = { ...r, lateState, earlyState },
      a = assessment(row, c, now),
      s = stats([row], c, "2", period(r.date), now);
    assert.equal(a.lateCount, lateCount);
    assert.equal(a.earlyCount, earlyCount);
    assert.equal(s.earlyDetected, 1);
    assert.equal(s.earlyJustified, 1 - earlyCount);
  }
  assert.equal(assessment({ ...r, exit: "19:30" }, c, now).earlyCount, 0);
});
test("justificaciones previas y JSON de formato anterior se interpretan sin migrar ni sobrescribir campos", () => {
  for (const lateState of ["justified", "unjustified", "pending"]) {
    const old = {
        ...example(),
        lateState,
        earlyState: "pending",
        revision: 4,
        history: [],
      },
      snapshot = JSON.stringify(old),
      restored = JSON.parse(snapshot);
    validateRecord(restored);
    assert.equal(
      assessment(restored, c, now).lateCount,
      lateState === "justified" ? 0 : 1,
    );
    assert.equal(JSON.stringify(old), snapshot);
  }
});
test("no hay omisiones automáticas, ausencias ni incidencias futuras; períodos y vínculos aislados", () => {
  const empty = blank("2026-11-12", "2", c),
    a = assessment(empty, c, now);
  assert.equal(a.lateCount + a.earlyCount + a.omissions, 0);
  assert.equal(empty.type, "normal");
  assert.equal(
    assessment({ ...example(), date: "2026-11-19" }, c, now).lateCount,
    0,
  );
  const r = example(),
    p = period(r.date);
  assert.equal(stats([r], c, "1", p, now).lateDetected, 0);
  assert.equal(stats([r], c, "2", period("2026-11-16"), now).lateDetected, 0);
});
