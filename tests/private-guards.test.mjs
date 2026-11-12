import test from "node:test";
import assert from "node:assert/strict";
import {
  minute,
  civil,
  paraguayNow,
  initialData,
  ensureCoverage,
  findPeriod,
  periodLabel,
  calculateShift,
  upsertShift,
  rerateShift,
  removeShift,
  periodSummary,
  editPeriod,
  changeSettings,
  mergePrivateData,
  validateData,
} from "../js/private/domain.js";
const now = "2026-11-12T12:00";
const base = () => initialData(now);
function fixture(start, end) {
  const data = upsertShift(base(), { start, end });
  return {
    data,
    s: data.shifts[0],
    v: calculateShift(data.shifts[0], data.periods),
  };
}
test("fechas civiles Paraguay, sin desplazamiento por la zona del proceso", () => {
  assert.equal(civil(minute("2026-12-06T00:00")), "2026-12-06T00:00");
  assert.equal(
    paraguayNow(new Date("2026-12-06T03:00:00Z")),
    "2026-12-06T00:00",
  );
  assert.throws(() => minute("2026-02-30T07:00"));
  assert.throws(() => minute("2026-11-12T24:00"));
});
test("lunes 19 a martes 7: doce horas normales, Gs.528.000", () => {
  const { v } = fixture("2026-11-09T19:00", "2026-11-10T07:00");
  assert.equal(v.normalMinutes, 720);
  assert.equal(v.weekendMinutes, 0);
  assert.equal(v.amount, 528000n);
});
test("viernes 19:30 a sábado 7: once horas treinta normales", () => {
  const { v } = fixture("2026-11-13T19:30", "2026-11-14T07:00");
  assert.equal(v.normalMinutes, 690);
  assert.equal(v.amount, 506000n);
});
test("sábado 19 a domingo 7: doce horas fin de semana, Gs.594.000", () => {
  const { v } = fixture("2026-11-14T19:00", "2026-11-15T07:00");
  assert.equal(v.weekendMinutes, 720);
  assert.equal(v.normalMinutes, 0);
  assert.equal(v.amount, 594000n);
});
test("límite sábado07:01: 07:00–07:01 normal, instante07:01 fin de semana", () => {
  let f = fixture("2026-11-14T07:00", "2026-11-14T07:01");
  assert.equal(f.v.normalMinutes, 1);
  assert.equal(f.v.amount, 733n);
  f = fixture("2026-11-14T07:01", "2026-11-14T07:02");
  assert.equal(f.v.weekendMinutes, 1);
  assert.equal(f.v.amount, 825n);
  f = fixture("2026-11-14T07:00", "2026-11-14T07:02");
  assert.equal(f.v.normalMinutes + f.v.weekendMinutes, 2);
  assert.equal(f.v.amount, 1558n);
});
test("lunes07:00 vuelve a normal, sin duplicar el instante de cambio", () => {
  const { v } = fixture("2026-11-16T06:59", "2026-11-16T07:01");
  assert.equal(v.normalMinutes, 1);
  assert.equal(v.weekendMinutes, 1);
  assert.equal(v.amount, 1558n);
  assert.equal(v.segments.length, 2);
});
test("ejemplo obligatorio: único registro 05/12 19–06/12 07, 247.500 y346.500", () => {
  const { data, s, v } = fixture("2026-12-05T19:00", "2026-12-06T07:00");
  assert.equal(data.shifts.length, 1);
  assert.equal(v.amount, 594000n);
  assert.deepEqual(
    v.allocations.map((a) => [a.minutes, a.amount]),
    [
      [300, 247500n],
      [420, 346500n],
    ],
  );
  const first = findPeriod(data, minute(s.start)),
    second = findPeriod(data, minute("2026-12-06T00:00"));
  assert.equal(periodLabel(first), "06/11/2026 – 05/12/2026");
  assert.equal(periodLabel(second), "06/12/2026 – 05/01/2027");
  assert.deepEqual(first.billing, { from: "2026-12-10", to: "2026-12-15" });
  assert.equal(
    periodSummary(data, first).rows[0].shift.id,
    periodSummary(data, second).rows[0].shift.id,
  );
});
test("cambio simultáneo de tarifa y cierre a sábado07:01", () => {
  let data = base();
  const p = findPeriod(data, minute("2026-11-07T07:00"));
  data = editPeriod(
    data,
    p.id,
    {
      start: p.start,
      end: "2026-11-07T07:01",
      billFrom: p.billing.from,
      billTo: p.billing.to,
    },
    now,
  ).data;
  data = upsertShift(data, {
    start: "2026-11-07T07:00",
    end: "2026-11-07T07:02",
  });
  const v = calculateShift(data.shifts[0], data.periods);
  assert.equal(v.segments.length, 2);
  assert.equal(v.allocations.length, 2);
  assert.deepEqual(
    v.allocations.map((a) => [a.minutes, a.amount]),
    [
      [1, 733n],
      [1, 825n],
    ],
  );
});
test("minutos proporcionales y redondeo equilibrado entre períodos", () => {
  let data = upsertShift(base(), {
    start: "2026-11-06T23:59",
    end: "2026-11-07T00:01",
  });
  const s = data.shifts[0],
    p = findPeriod(data, minute(s.start));
  data = editPeriod(
    data,
    p.id,
    {
      start: p.start,
      end: "2026-11-07T00:00",
      billFrom: p.billing.from,
      billTo: p.billing.to,
    },
    now,
  ).data;
  const v = calculateShift(s, data.periods);
  assert.equal(v.amount, 1467n);
  assert.deepEqual(
    v.allocations.map((a) => a.amount),
    [734n, 733n],
  );
  assert.equal(
    v.allocations.reduce((n, a) => n + a.amount, 0n),
    v.amount,
  );
});
test("guardia multidiaria: suma exacta de minutos/tramos/periodos y tarifas no flotantes", () => {
  const { data, s, v } = fixture("2026-10-01T06:59", "2027-01-10T07:02");
  assert.equal(
    v.segments.reduce((n, t) => n + t.minutes, 0),
    minute(s.end) - minute(s.start),
  );
  assert.equal(
    v.allocations.reduce((n, t) => n + t.minutes, 0),
    v.minutes,
  );
  assert.equal(
    v.allocations.reduce((n, t) => n + t.amount, 0n),
    v.amount,
  );
  assert.equal(v.normalMinutes + v.weekendMinutes, v.minutes);
  validateData(data);
});
test("editar límites individuales ajusta vecinos, conserva factura explícita y detecta pasado/datos afectados", () => {
  const f = fixture("2026-12-05T19:00", "2026-12-06T07:00"),
    p = findPeriod(f.data, minute("2026-11-12T00:00"));
  const result = editPeriod(
    f.data,
    p.id,
    {
      start: "2026-11-07T00:00",
      end: "2026-12-07T00:00",
      billFrom: "2026-12-11",
      billTo: "2026-12-18",
    },
    now,
  );
  const index = result.data.periods.findIndex((x) => x.id === p.id);
  assert.equal(result.data.periods[index - 1].end, "2026-11-07T00:00");
  assert.equal(result.data.periods[index + 1].start, "2026-12-07T00:00");
  assert.equal(result.needsConfirmation, true);
  assert.equal(result.affects, 1);
  assert.equal(result.data.periods[index].billing.to, "2026-12-18");
  validateData(result.data);
  assert.throws(() =>
    editPeriod(
      f.data,
      p.id,
      {
        start: p.start,
        end: f.data.periods[index + 1].end,
        billFrom: p.billing.from,
        billTo: p.billing.to,
      },
      now,
    ),
  );
  assert.deepEqual(f.data.shifts[0], f.s);
});
test("patrón y factura futuros: conserva actual/pasados, aplica siguiente y confirma datos futuros", () => {
  let data = base();
  const current = findPeriod(data, minute(now)),
    before = structuredClone(
      data.periods.filter((p) => minute(p.start) <= minute(current.start)),
    );
  data = upsertShift(data, {
    start: "2026-12-15T19:00",
    end: "2026-12-16T07:00",
  });
  const config = {
      rates: { normal: 45000, weekend: 50000 },
      pattern: { day: 10, time: "08:00", billStart: 12, billEnd: 18 },
    },
    result = changeSettings(data, config, now);
  assert.deepEqual(
    result.data.periods.filter((p) => minute(p.start) <= minute(current.start)),
    before,
  );
  assert.equal(result.firstFuture.start, "2026-12-06T00:00");
  assert.equal(result.firstFuture.end, "2027-01-10T08:00");
  assert.deepEqual(result.firstFuture.billing, {
    from: "2027-01-12",
    to: "2027-01-18",
  });
  assert.equal(result.needsConfirmation, true);
  assert.equal(result.data.shifts[0].rates.normal, 44000);
});
test("tarifas históricas inmutables, edición usa instantánea, recálculo explícito y eliminación", () => {
  let { data, s, v } = fixture("2026-11-09T19:00", "2026-11-10T07:00");
  data = changeSettings(
    data,
    { ...data.config, rates: { normal: 50000, weekend: 60000 } },
    now,
  ).data;
  assert.equal(calculateShift(data.shifts[0], data.periods).amount, v.amount);
  data = upsertShift(data, {
    id: s.id,
    start: s.start,
    end: "2026-11-10T08:00",
  });
  assert.equal(data.shifts[0].rates.normal, 44000);
  data = rerateShift(data, s.id, data.config.rates);
  assert.equal(calculateShift(data.shifts[0], data.periods).amount, 650000n);
  assert.ok(data.shifts[0].history.some((h) => h.action.includes("Recálculo")));
  assert.equal(removeShift(data, s.id).shifts.length, 0);
});
test("validación, duplicados, patrón31 clampa a mes corto y extensión histórica", () => {
  const data = base();
  assert.throws(() =>
    upsertShift(data, { start: "2026-11-12T07:00", end: "2026-11-12T07:00" }),
  );
  let f = fixture("2026-11-09T19:00", "2026-11-10T07:00");
  assert.throws(() => upsertShift(f.data, { start: f.s.start, end: f.s.end }));
  let result = changeSettings(
    data,
    {
      ...data.config,
      pattern: { day: 31, time: "00:00", billStart: 30, billEnd: 31 },
    },
    now,
  ).data;
  ensureCoverage(
    result,
    minute("2027-02-01T00:00"),
    minute("2027-04-01T00:00"),
  );
  assert.ok(result.periods.some((p) => p.end === "2027-02-28T00:00"));
  ensureCoverage(
    result,
    minute("2020-01-01T00:00"),
    minute("2020-01-02T00:00"),
  );
  validateData(result);
});
test("combinación de JSON compatible conserva locales y rechaza calendarios conflictivos", () => {
  const f = fixture("2026-11-09T19:00", "2026-11-10T07:00"),
    current = f.data,
    copy = structuredClone(f.data);
  assert.equal(mergePrivateData(undefined, copy).added, 1);
  assert.equal(mergePrivateData(current, copy).skipped, 1);
  const p = findPeriod(copy, minute(now));
  const changed = editPeriod(
    copy,
    p.id,
    {
      start: p.start,
      end: "2026-12-07T00:00",
      billFrom: p.billing.from,
      billTo: p.billing.to,
    },
    now,
  ).data;
  assert.throws(() => mergePrivateData(current, changed));
  assert.deepEqual(current, f.data);
});

test("cambiar solo factura conserva límites individuales e historial y pide confirmar reemplazo", () => {
  let data = base();
  const p = findPeriod(data, minute("2027-01-12T12:00"));
  data = editPeriod(
    data,
    p.id,
    {
      start: p.start,
      end: "2027-02-08T08:30",
      billFrom: "2027-02-11",
      billTo: "2027-02-19",
    },
    now,
  ).data;
  const before = structuredClone(data),
    config = structuredClone(data.config);
  config.pattern.billStart = 12;
  config.pattern.billEnd = 20;
  const result = changeSettings(data, config, now);
  assert.equal(result.boundariesChanged, false);
  assert.equal(result.needsConfirmation, true);
  assert.deepEqual(
    result.data.periods.map((p) => [p.start, p.end]),
    before.periods.map((p) => [p.start, p.end]),
  );
  const changed = result.data.periods.find((q) => q.id === p.id);
  assert.deepEqual(changed.billing, { from: "2027-02-12", to: "2027-02-20" });
  assert.deepEqual(
    changed.history[0],
    before.periods.find((q) => q.id === p.id).history[0],
  );
  const oldPeriods = before.periods.filter(
    (p) => minute(p.start) <= minute(now),
  );
  assert.deepEqual(
    result.data.periods.filter((p) => minute(p.start) <= minute(now)),
    oldPeriods,
  );
  const newPattern = structuredClone(config);
  newPattern.pattern.day = 8;
  const again = changeSettings(result.data, newPattern, now);
  assert.equal(again.needsConfirmation, true);
  assert.ok(
    again.data.periods
      .find((q) => q.id === p.id)
      .history.some((h) => h.action.startsWith("Ajuste individual")),
  );
});

test("cambiar factura no cambia importes y ajustar cierre redistribuye sin cambiar el total", () => {
  const f = fixture("2026-12-05T19:00", "2026-12-06T07:00"),
    p = findPeriod(f.data, minute(f.s.start));
  const data = editPeriod(
    f.data,
    p.id,
    {
      start: p.start,
      end: "2026-12-06T01:00",
      billFrom: "2026-12-12",
      billTo: "2026-12-20",
    },
    now,
  ).data;
  const v = calculateShift(data.shifts[0], data.periods);
  assert.deepEqual(
    v.allocations.map((a) => [a.minutes, a.amount]),
    [
      [360, 297000n],
      [360, 297000n],
    ],
  );
  assert.equal(v.amount, f.v.amount);
  assert.deepEqual(data.shifts[0], f.s);
});

test("importar no borra la auditoría de guardias eliminadas", () => {
  const f = fixture("2026-11-09T19:00", "2026-11-10T07:00"),
    cleared = removeShift(f.data, f.s.id);
  const result = mergePrivateData(cleared, f.data);
  assert.deepEqual(result.data.history[0], cleared.history[0]);
  assert.equal(result.added, 1);
});
