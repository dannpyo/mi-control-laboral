import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  blank,
  applicableLinks,
  calendarState,
  stats,
  period,
  formatMinutes,
  assessment,
} from "../js/modules/domain.js";
const c = { ...defaults(), startDate: "2026-11-01" };
const now = new Date("2026-11-15T21:00:00");
const make = (date = "2026-11-04", link = "1", extra = {}) => ({
  ...blank(date, link, c),
  ...extra,
});
const complete = {
  entry: "07:30",
  exit: "19:30",
  officialEntry: "marked",
  officialExit: "marked",
  closed: true,
};
test("miércoles, jueves, domingo y lunes sin registros: solo vínculos programados", () => {
  for (const [date, ids] of [
    ["2026-11-04", ["1"]],
    ["2026-11-05", ["2"]],
    ["2026-11-08", ["3"]],
    ["2026-11-09", []],
  ])
    assert.deepEqual(
      applicableLinks(date, [], c).map((l) => l.id),
      ids,
    );
  // El inicio de seguimiento no oculta el calendario ni bloquea ingreso histórico.
  assert.deepEqual(
    applicableLinks("2026-11-04", [], { ...c, startDate: "2026-11-12" }).map(
      (l) => l.id,
    ),
    ["1"],
  );
});
test("excepciones y situaciones especiales visibles por vínculo y filtros independientes", () => {
  const rows = [make("2026-11-04", "2", { type: "permission" })];
  assert.deepEqual(
    applicableLinks("2026-11-04", rows, c).map((l) => l.id),
    ["1", "2"],
  );
  assert.deepEqual(
    applicableLinks("2026-11-04", rows, c, "2").map((l) => l.id),
    ["2"],
  );
  assert.deepEqual(applicableLinks("2026-11-04", rows, c, "3"), []);
  assert.deepEqual(applicableLinks("2026-11-09", [], c, "1"), []);
});
test("leyenda basada en horas sin depender de cierre/confirmaciones; situaciones neutras", () => {
  assert.equal(calendarState(null, c, now), "scheduled");
  assert.equal(calendarState(make(), c, now), "review");
  assert.equal(
    calendarState(
      make(undefined, undefined, { ...complete, entry: "" }),
      c,
      now,
    ),
    "incident",
  );
  assert.equal(
    calendarState(make(undefined, undefined, complete), c, now),
    "validated",
  );
  assert.equal(
    calendarState(
      make(undefined, undefined, { ...complete, officialEntry: "missing" }),
      c,
      now,
    ),
    "validated",
  );
  for (const type of [
    "holiday-free",
    "permission",
    "vacation",
    "medical",
    "justified",
    "swap",
  ])
    assert.equal(
      calendarState(make(undefined, undefined, { type }), c, now),
      "special",
    );
  assert.equal(
    calendarState(make(undefined, undefined, { type: "pending" }), c, now),
    "review",
  );
});
test("rojo para incidencia no justificada automáticamente; futuro nunca rojo", () => {
  const r = make(undefined, undefined, { ...complete, entry: "08:00" });
  assert.equal(
    calendarState({ ...r, lateState: "pending" }, c, now),
    "incident",
  );
  assert.equal(
    calendarState({ ...r, lateState: "justified" }, c, now),
    "validated",
  );
  assert.equal(
    calendarState({ ...r, lateState: "unjustified" }, c, now),
    "incident",
  );
  assert.equal(
    calendarState(make(undefined, undefined, { type: "unjustified" }), c, now),
    "incident",
  );
  assert.equal(
    calendarState(
      { ...r, date: "2026-11-18", lateState: "unjustified" },
      c,
      now,
    ),
    "scheduled",
  );
});
test("vacíos, incompletos, completos, cerrados y excepcionales son métricas distintas", () => {
  const rows = [
    make(),
    make("2026-11-11", "1", { entry: "07:30" }),
    make("2026-11-12", "1", complete),
    make("2026-11-05", "2", complete),
  ];
  const s = stats(rows, c, "1", period("2026-11-12"), now);
  assert.equal(s.complete, 1);
  assert.equal(s.incomplete, 2);
  assert.equal(s.saved, 3);
  assert.equal(s.closed, 1);
  assert.equal(s.validated, 1);
  assert.equal(s.exceptional, 1);
  assert.equal(s.personalMinutes, 720);
  assert.equal(stats(rows, c, "2", period("2026-11-12"), now).complete, 1);
  assert.equal(stats(rows, c, "3", period("2026-11-12"), now).complete, 0);
  assert.equal(
    stats([], c, "1", period("2026-11-12"), new Date("2026-11-09T21:00:00"))
      .unrecorded,
    1,
  );
});
test("una excepción no modifica horarios ni número de jornadas programadas permanentes", () => {
  const p = period("2026-11-12"),
    before = structuredClone(c);
  const a = stats([], c, "2", p, now),
    b = stats([make("2026-11-04", "2", complete)], c, "2", p, now);
  assert.equal(a.scheduled, b.scheduled);
  assert.equal(a.scheduledMinutes, b.scheduledMinutes);
  assert.deepEqual(c, before);
});
test("minutos enteros, formato y diferencia solo para jornadas completas comparables", () => {
  assert.equal(formatMinutes(659), "10 h 59 min");
  assert.equal(formatMinutes(720), "12 h 00 min");
  assert.equal(formatMinutes(690), "11 h 30 min");
  assert.equal(formatMinutes(-61), "−1 h 01 min");
  const row = make(undefined, undefined, { ...complete, entry: "08:31" }),
    s = stats(
      [row, make("2026-11-11", "1", { entry: "07:30" })],
      c,
      "1",
      period("2026-11-12"),
      now,
    );
  assert.equal(assessment(row, c, now).workedMinutes, 659);
  assert.equal(s.personalMinutes, 659);
  assert.equal(s.comparableMinutes, 720);
  assert.equal(s.deltaMinutes, -61);
  assert.equal(
    stats([make()], c, "1", period("2026-11-12"), now).deltaMinutes,
    null,
  );
  assert.equal(
    stats(
      [make(undefined, undefined, { type: "vacation", ...complete })],
      c,
      "1",
      period("2026-11-12"),
      now,
    ).complete,
    0,
  );
});
test("inicio limita vacíos, no jornadas históricas guardadas ni otros períodos; sin faltas retroactivas", () => {
  const config = { ...c, startDate: "2026-11-12" },
    p = period("2026-11-12");
  const empty = stats([], config, "1", p, now);
  assert.equal(empty.unrecorded, 0);
  assert.equal(empty.absences + empty.omissions + empty.late, 0);
  const a = stats([make(undefined, undefined, complete)], config, "1", p, now);
  assert.equal(a.complete, 1);
  assert.equal(a.unrecorded, 0);
  const b = stats(
    [make(undefined, undefined, complete)],
    config,
    "1",
    period("2026-11-16"),
    now,
  );
  assert.equal(b.complete, 0);
  assert.equal(b.personalMinutes, 0);
});
