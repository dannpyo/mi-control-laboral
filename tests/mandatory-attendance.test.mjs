import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  blank,
  assessment,
  stats,
  period,
  periodRecords,
  effectiveRecord,
  calendarState,
  validateRecord,
} from "../js/modules/domain.js";
const config = { ...defaults(), startDate: "2026-10-16" },
  now = new Date("2026-11-15T20:00:00");
const row = (date, link, extra = {}) => ({
  ...blank(date, link, config),
  ...extra,
});
test("ejemplos obligatorios: jueves tardanza+omisión de salida y domingo omisión de entrada", () => {
  const a = assessment(row("2026-10-29", "2", { entry: "08:08" }), config, now);
  assert.equal(a.lateCount, 1);
  assert.equal(a.lateMinutes, 38);
  assert.equal(a.omissions, 1);
  const b = assessment(row("2026-10-18", "3", { exit: "19:07" }), config, now);
  assert.equal(b.omissions, 1);
  assert.equal(b.earlyCount, 0);
  assert.equal(b.possibleAbsence, false);
});
test("sin confirmaciones: los campos administrativos heredados no condicionan omisiones ni jornadas completas", () => {
  for (const closed of [false, true])
    for (const official of ["pending", "marked", "missing"]) {
      const r = row("2026-11-12", "2", {
        entry: "07:30",
        closed,
        officialEntry: official,
        officialExit: official,
      });
      assert.equal(assessment(r, config, now).omissions, 1);
      assert.equal(
        calendarState({ ...r, exit: "19:30" }, config, now),
        "validated",
      );
    }
});
test("estrictamente después de la salida, nunca en jornadas futuras ni en el instante exacto", () => {
  const r = row("2026-11-12", "2", { entry: "07:30" });
  for (const instant of [
    "2026-11-11T21:00:00",
    "2026-11-12T19:29:59",
    "2026-11-12T19:30:00",
  ])
    assert.equal(assessment(r, config, new Date(instant)).omissions, 0);
  assert.equal(
    assessment(r, config, new Date("2026-11-12T19:30:01")).omissions,
    1,
  );
  assert.equal(
    assessment(r, config, new Date("2026-11-12T19:30:00.001")).omissions,
    1,
  );
  const empty = row("2026-11-12", "2");
  assert.equal(
    assessment(empty, config, new Date("2026-11-12T19:30:00")).possibleAbsence,
    false,
  );
  assert.equal(
    assessment(empty, config, new Date("2026-11-12T19:30:01")).possibleAbsence,
    true,
  );
});
test("jornada sin marcas genera posible ausencia y nunca dos omisiones/ausencia definitiva automáticamente", () => {
  const r = row("2026-11-12", "2"),
    a = assessment(r, config, now);
  assert.equal(a.possibleAbsence, true);
  assert.equal(a.omissions, 0);
  assert.equal(r.type, "normal");
  assert.equal(
    assessment({ ...r, type: "double-omission" }, config, now).omissions,
    2,
  );
  assert.equal(
    assessment({ ...r, type: "double-omission" }, config, now).possibleAbsence,
    false,
  );
  assert.equal(
    assessment({ ...r, type: "unjustified" }, config, now).possibleAbsence,
    false,
  );
  assert.equal(
    stats([{ ...r, type: "unjustified" }], config, "2", period(r.date), now)
      .absences,
    1,
  );
});
test("excepciones que eximen asistencia y feriados libres eliminan ausencia/omisiones", () => {
  for (const type of [
    "permission",
    "vacation",
    "medical",
    "holiday-free",
    "swap",
    "justified",
  ])
    for (const entry of ["", "08:30"]) {
      const a = assessment(
        row("2026-11-12", "2", { type, entry }),
        config,
        now,
      );
      assert.equal(a.possibleAbsence, false);
      assert.equal(a.omissions + a.lateCount + a.earlyCount, 0);
    }
  assert.equal(
    assessment(row("2026-11-12", "2", { type: "holiday-work" }), config, now)
      .possibleAbsence,
    true,
  );
});
test("justificaciones por incidencia preservan detección e historial y son independientes", () => {
  const r = row("2026-11-12", "2", {
      entry: "08:08",
      lateState: "justified",
      omissionJustified: true,
    }),
    original = structuredClone(r),
    a = assessment(r, config, now);
  assert.equal(a.late, true);
  assert.equal(a.lateCount, 0);
  assert.equal(a.omissionDetected, 1);
  assert.equal(a.omissions, 0);
  assert.equal(
    assessment({ ...r, omissionJustified: false }, config, now).omissions,
    1,
  );
  assert.deepEqual(r, original);
  validateRecord(r);
});
test("programación virtual sin escrituras: fechas laborables, seguimiento, excepciones y aislamiento", () => {
  const records = [],
    p = period("2026-11-12"),
    rows = periodRecords(records, config, "2", p);
  assert.equal(rows.length, 4);
  assert.equal(records.length, 0);
  assert.ok(rows.every((r) => r.virtual));
  assert.equal(effectiveRecord("2026-11-09", "2", records, config), null);
  assert.equal(effectiveRecord("2026-10-15", "2", records, config), null);
  const s = stats(records, config, "2", p, now);
  assert.equal(s.possibleAbsences, 4);
  assert.equal(s.omissions, 0);
  assert.equal(s.absences, 0);
  const saved = row("2026-10-29", "2", { entry: "08:08" }),
    changed = stats([saved], config, "2", p, now);
  assert.equal(changed.possibleAbsences, 3);
  assert.equal(changed.omissions, 1);
  assert.equal(changed.late, 1);
  assert.equal(stats([saved], config, "1", p, now).omissions, 0);
  assert.equal(
    stats([saved], config, "2", period("2026-11-16"), now).omissions,
    0,
  );
});
test("compatibilidad de históricos sin reescribir horas, campos administrativos, justificaciones o auditoría", () => {
  const r = row("2026-10-29", "2", {
      entry: "08:08",
      lateState: "justified",
      officialEntry: "marked",
      officialExit: "pending",
      closed: false,
      history: [
        {
          at: "2026-10-29T22:00:00Z",
          action: "Antigua",
          before: null,
          after: { entry: "08:08" },
        },
      ],
    }),
    before = JSON.stringify(r);
  const imported = JSON.parse(before);
  validateRecord(imported);
  const a = assessment(imported, config, now);
  assert.equal(a.omissions, 1);
  assert.equal(a.lateCount, 0);
  assert.equal(JSON.stringify(imported), before);
  const double = row("2026-10-18", "3", {
    officialEntry: "missing",
    officialExit: "missing",
    closed: true,
  });
  assert.equal(assessment(double, config, now).omissions, 2);
});
