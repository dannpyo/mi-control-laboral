import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  blank,
  period,
  assessment,
  stats,
  fine,
  validateRecord,
  validateConfig,
} from "../js/modules/domain.js";
const config = defaults(),
  now = new Date("2026-11-15T20:00:00");
const record = (extra = {}) => ({
  ...blank("2026-11-11", "1", config),
  ...extra,
});
test("tolerancia inclusiva normal y por lluvia: no se suman", () => {
  for (const [entry, rain, late] of [
    ["07:45", false, false],
    ["07:46", false, true],
    ["08:30", true, false],
    ["08:31", true, true],
  ])
    assert.equal(assessment(record({ entry, rain }), config, now).late, late);
});
test("salida prevista inclusiva y sin compensación por horas posteriores", () => {
  assert.equal(assessment(record({ exit: "19:30" }), config, now).early, false);
  assert.equal(assessment(record({ exit: "19:29" }), config, now).early, true);
  assert.equal(
    assessment(record({ entry: "08:00", exit: "22:00" }), config, now).late,
    true,
  );
});
test("períodos: día 15, día 16, cambio anual y año bisiesto", () => {
  assert.deepEqual(period("2026-11-15"), {
    start: "2026-10-16",
    end: "2026-11-15",
  });
  assert.deepEqual(period("2026-11-16"), {
    start: "2026-11-16",
    end: "2026-12-15",
  });
  assert.deepEqual(period("2026-01-01"), {
    start: "2025-12-16",
    end: "2026-01-15",
  });
  assert.deepEqual(period("2024-02-29"), {
    start: "2024-02-16",
    end: "2024-03-15",
  });
});
test("contadores independientes por vínculo, tipo y período; reinicio sin borrar", () => {
  const rs = [
    record({
      entry: "08:00",
      exit: "19:00",
      lateState: "unjustified",
      earlyState: "justified",
    }),
    {
      ...blank("2026-11-12", "2", config),
      entry: "08:00",
      lateState: "unjustified",
    },
    record({ date: "2026-10-14", entry: "08:00", lateState: "unjustified" }),
  ];
  const p = period("2026-11-12");
  assert.equal(stats(rs, config, "1", p, now).late, 1);
  assert.equal(stats(rs, config, "1", p, now).early, 0);
  assert.equal(stats(rs, config, "2", p, now).late, 1);
  assert.equal(stats(rs, config, "3", p, now).late, 0);
  assert.equal(stats(rs, config, "1", period("2026-11-16"), now).late, 0);
  assert.equal(rs.length, 3);
});
test("cómputo automático salvo justificación, incluidos estados pendientes heredados", () => {
  for (const state of ["pending", "justified", "unjustified"]) {
    const a = assessment(
      record({
        entry: "08:00",
        exit: "19:00",
        lateState: state,
        earlyState: state,
        closed: true,
        officialEntry: "marked",
        officialExit: "marked",
      }),
      config,
      now,
    );
    assert.equal(a.lateCount, state !== "justified" ? 1 : 0);
    assert.equal(a.earlyCount, state !== "justified" ? 1 : 0);
    assert.equal(a.pending, false);
  }
});
test("omisión oficial explícita, solo al cerrar y después de la salida", () => {
  assert.equal(
    assessment(record({ entry: "", exit: "" }), config, now).omissions,
    0,
  );
  const r = record({
    officialEntry: "missing",
    officialExit: "missing",
    closed: true,
  });
  assert.equal(assessment(r, config, now).omissions, 2);
  assert.equal(r.type, "normal");
  assert.equal(assessment({ ...r, closed: false }, config, now).omissions, 0);
  assert.equal(
    assessment(r, config, new Date("2026-11-11T12:00:00")).omissions,
    0,
  );
  assert.equal(
    assessment(r, config, new Date("2026-11-11T19:30:00")).omissions,
    2,
  );
});
test("escalas completas de sanción informativa", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, i) => fine(i, "omission")),
    [0, 0, 1, 2, 3, 4, "Revisión normativa", "Revisión normativa"],
  );
  assert.deepEqual(
    Array.from({ length: 10 }, (_, i) => fine(i, "late")),
    [0, 0, 0, 1, 2, 3, 4, 5, 5, 5],
  );
  assert.deepEqual(
    Array.from({ length: 10 }, (_, i) => fine(i, "early")),
    [0, 0, 0, 1, 2, 3, 4, 5, 5, 5],
  );
});
test("feriado libre por defecto, excepción editable por vínculo y futuro sin faltas", () => {
  const c = { ...config, holidays: ["2026-11-11"] };
  const free = blank("2026-11-11", "1", c);
  assert.equal(free.type, "holiday-free");
  assert.equal(blank("2026-11-11", "2", c).type, "holiday-free");
  const r = {
    ...free,
    entry: "10:00",
    exit: "18:00",
    lateState: "unjustified",
    earlyState: "unjustified",
    officialEntry: "missing",
    closed: true,
  };
  assert.equal(assessment(r, c, now).lateCount, 0);
  assert.equal(assessment(r, c, now).omissions, 0);
  assert.equal(assessment({ ...r, type: "holiday-work" }, c, now).lateCount, 1);
  assert.equal(
    assessment(
      { ...r, type: "holiday-work" },
      c,
      new Date("2026-11-10T20:00:00"),
    ).lateCount,
    0,
  );
});
test("situaciones exentas no generan incidencias; ausencia injustificada explícita", () => {
  for (const type of [
    "holiday-free",
    "permission",
    "vacation",
    "medical",
    "justified",
    "unjustified",
    "swap",
    "pending",
  ]) {
    const a = assessment(
      record({
        type,
        entry: "10:00",
        exit: "17:00",
        lateState: "unjustified",
        earlyState: "unjustified",
        closed: true,
        officialEntry: "missing",
      }),
      config,
      now,
    );
    assert.equal(a.lateCount + a.earlyCount + a.omissions, 0);
  }
  assert.equal(
    stats([record()], config, "1", period("2026-11-12"), now).absences,
    0,
  );
});
test("horario conservado aunque cambie la configuración", () => {
  const r = record({ entry: "07:46" }),
    c = structuredClone(config);
  c.normalTolerance = 90;
  c.links[0].start = "09:00";
  assert.equal(assessment(r, c, now).late, true);
});
test("validación de registros, fechas, horario y respaldo", () => {
  validateConfig(config);
  validateRecord(record());
  for (const bad of [
    { entry: "25:00" },
    { date: "2026-02-30" },
    { link: "9" },
    { entry: "12:00", exit: "11:00" },
    { officialEntry: "inventado" },
  ])
    assert.throws(() => validateRecord(record(bad)));
  assert.throws(() => validateConfig({ ...config, rainTolerance: 1 }));
  assert.throws(() => validateConfig({ ...config, holidays: ["2026-02-30"] }));
});

test("jornadas transcurridas sin registro se señalan sin inventar ausencias ni omisiones", () => {
  const c = { ...config, startDate: "2026-11-01" };
  const s = stats([], c, "1", period("2026-11-12"), now);
  assert.equal(s.unrecorded, 2);
  assert.equal(s.absences + s.omissions + s.late, 0);
  assert.equal(
    stats(
      [],
      { ...c, holidays: ["2026-11-11"] },
      "1",
      period("2026-11-12"),
      now,
    ).unrecorded,
    1,
  );
});
