// Fechas civiles de Paraguay: YYYY-MM-DDTHH:mm; nunca convertirlas con toISOString.
const MINUTE = 60000,
  DAY = 1440;
export function minute(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))
    throw Error("Fecha y hora inválidas");
  const [y, m, d, h, n] = value.match(/\d+/g).map(Number),
    date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(h, n, 0, 0);
  if (
    y < 1 ||
    h > 23 ||
    n > 59 ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    throw Error("Fecha y hora inválidas");
  return date.valueOf() / MINUTE;
}
export function civil(value) {
  const d = new Date(value * MINUTE);
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
export function paraguayNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Asuncion",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export const displayDate = (value) =>
  `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
export const displayTime = (value) =>
  `${displayDate(value)} ${value.slice(11, 16)}`;
export const duration = (n) =>
  `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")} min`;
export const money = (n) =>
  `Gs. ${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n)}`;
export const uid = () => crypto.randomUUID();
function monthDate(year, month, day, time = "00:00") {
  const first = new Date(0);
  first.setUTCFullYear(year, month, 1);
  first.setUTCHours(0, 0, 0, 0);
  const last = new Date(0);
  last.setUTCFullYear(year, month + 1, 0);
  const date =
    civil(first.valueOf() / MINUTE).slice(0, 7) +
    `-${String(Math.min(day, last.getUTCDate())).padStart(2, "0")}T${time}`;
  minute(date);
  return date;
}
function nextBoundary(start, pattern, delta = 1) {
  const d = new Date(minute(start) * MINUTE);
  return monthDate(
    d.getUTCFullYear(),
    d.getUTCMonth() + delta,
    pattern.day,
    pattern.time,
  );
}
function billing(end, pattern) {
  const d = new Date(minute(end) * MINUTE);
  return {
    from: monthDate(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      pattern.billStart,
    ).slice(0, 10),
    to: monthDate(d.getUTCFullYear(), d.getUTCMonth(), pattern.billEnd).slice(
      0,
      10,
    ),
  };
}
function makePeriod(start, end, pattern) {
  return {
    id: uid(),
    start,
    end,
    pattern: { ...pattern },
    billing: billing(end, pattern),
    history: [],
  };
}
export function initialData(now = paraguayNow()) {
  const d = new Date(minute(now) * MINUTE),
    pattern = { day: 6, time: "00:00", billStart: 10, billEnd: 15 };
  let start = monthDate(d.getUTCFullYear(), d.getUTCMonth() - 12, 6),
    periods = [];
  for (let i = 0; i < 26; i++) {
    const end = nextBoundary(start, pattern);
    periods.push(makePeriod(start, end, pattern));
    start = end;
  }
  return {
    version: 1,
    revision: 0,
    userConfigured: false,
    config: { rates: { normal: 44000, weekend: 49500 }, pattern },
    shifts: [],
    periods,
    history: [],
  };
}
export function ensureCoverage(data, start, end = start + 1) {
  while (minute(data.periods[0].start) > start) {
    const first = data.periods[0],
      left = nextBoundary(first.start, first.pattern, -1);
    if (minute(left) >= minute(first.start))
      throw Error("No se pudo extender el período");
    data.periods.unshift(makePeriod(left, first.start, first.pattern));
  }
  while (minute(data.periods.at(-1).end) < end) {
    const last = data.periods.at(-1),
      next = nextBoundary(last.end, last.pattern);
    if (minute(next) <= minute(last.end))
      throw Error("No se pudo extender el período");
    data.periods.push(makePeriod(last.end, next, last.pattern));
  }
  return data;
}
export function findPeriod(data, point) {
  return data.periods.find(
    (p) => minute(p.start) <= point && point < minute(p.end),
  );
}
export function periodLabel(p) {
  return p.start.endsWith("T00:00") && p.end.endsWith("T00:00")
    ? `${displayDate(p.start)} – ${displayDate(civil(minute(p.end) - 1))}`
    : `${displayTime(p.start)} – ${displayTime(p.end)} (cierre)`;
}
export function validateRates(r) {
  if (
    !r ||
    ![r.normal, r.weekend].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 1000000000,
    )
  )
    throw Error(
      "Las tarifas deben ser guaraníes enteros positivos (hasta 1.000.000.000/h)",
    );
}
export function validatePattern(p) {
  if (
    !p ||
    ![p.day, p.billStart, p.billEnd].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= 31,
    ) ||
    p.billEnd < p.billStart ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)
  )
    throw Error("Patrón de liquidación o facturación inválido");
}
function validHistory(history) {
  if (!Array.isArray(history) || history.length > 100000)
    throw Error("Historial inválido");
  for (const h of history)
    if (
      !h ||
      typeof h.action !== "string" ||
      typeof h.at !== "string" ||
      !Number.isFinite(Date.parse(h.at))
    )
      throw Error("Historial inválido");
}
export function validateShift(s) {
  if (
    !s ||
    typeof s.id !== "string" ||
    !s.id ||
    s.id.length > 100 ||
    minute(s.end) <= minute(s.start)
  )
    throw Error("La salida debe ser posterior a la entrada");
  validateRates(s.rates);
  validHistory(s.history);
}
export function validateData(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    typeof data.userConfigured !== "boolean" ||
    !Array.isArray(data.shifts) ||
    data.shifts.length > 50000 ||
    !Array.isArray(data.periods) ||
    !data.periods.length ||
    data.periods.length > 120000
  )
    throw Error("Formato de Guardias privadas inválido");
  validateRates(data.config?.rates);
  validatePattern(data.config?.pattern);
  validHistory(data.history);
  const ids = new Set();
  for (const s of data.shifts) {
    validateShift(s);
    if (ids.has(s.id)) throw Error("Guardias privadas duplicadas");
    ids.add(s.id);
  }
  const pids = new Set();
  for (let i = 0; i < data.periods.length; i++) {
    const p = data.periods[i];
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      pids.has(p.id) ||
      minute(p.end) <= minute(p.start) ||
      (i && p.start !== data.periods[i - 1].end)
    )
      throw Error("Los períodos no pueden superponerse ni dejar huecos");
    pids.add(p.id);
    validatePattern(p.pattern);
    validHistory(p.history);
    minute(p.billing?.from + "T00:00");
    minute(p.billing?.to + "T00:00");
    if (p.billing.to < p.billing.from)
      throw Error("Ventana de facturación inválida");
  }
  for (const s of data.shifts)
    if (
      minute(s.start) < minute(data.periods[0].start) ||
      minute(s.end) > minute(data.periods.at(-1).end)
    )
      throw Error("Guardia sin período de liquidación");
}
function weekend(t) {
  const date = new Date(t * MINUTE),
    day = date.getUTCDay(),
    clock = date.getUTCHours() * 60 + date.getUTCMinutes();
  return day === 0 || (day === 6 && clock >= 421) || (day === 1 && clock < 420);
}
function nextTariff(t) {
  const dayStart = Math.floor(t / DAY) * DAY,
    day = new Date(t * MINUTE).getUTCDay();
  let sat = dayStart + ((6 - day + 7) % 7) * DAY + 421,
    mon = dayStart + ((1 - day + 7) % 7) * DAY + 420;
  if (sat <= t) sat += 7 * DAY;
  if (mon <= t) mon += 7 * DAY;
  return Math.min(sat, mon);
}
export function calculateShift(s, periods) {
  validateShift(s);
  let cursor = minute(s.start),
    end = minute(s.end),
    segments = [],
    map = new Map();
  let index = periods.findIndex(
    (p) => minute(p.start) <= cursor && cursor < minute(p.end),
  );
  if (index < 0) throw Error("Falta período de entrada");
  while (cursor < end) {
    const p = periods[index];
    if (!p) throw Error("Falta período de salida");
    const stop = Math.min(end, minute(p.end), nextTariff(cursor));
    if (stop <= cursor) throw Error("Períodos inválidos");
    const isWeekend = weekend(cursor),
      mins = stop - cursor,
      raw = BigInt(mins) * BigInt(isWeekend ? s.rates.weekend : s.rates.normal);
    let value = map.get(p.id);
    if (!value) {
      value = {
        periodId: p.id,
        minutes: 0,
        normalMinutes: 0,
        weekendMinutes: 0,
        raw: 0n,
        amount: 0n,
      };
      map.set(p.id, value);
    }
    value.minutes += mins;
    value[isWeekend ? "weekendMinutes" : "normalMinutes"] += mins;
    value.raw += raw;
    segments.push({
      start: civil(cursor),
      end: civil(stop),
      periodId: p.id,
      minutes: mins,
      weekend: isWeekend,
      raw,
    });
    cursor = stop;
    if (cursor === minute(p.end)) index++;
  }
  const allocations = [...map.values()],
    raw = allocations.reduce((sum, a) => sum + a.raw, 0n),
    amount = (raw + 30n) / 60n;
  for (const a of allocations) a.amount = a.raw / 60n;
  let remainder = amount - allocations.reduce((sum, a) => sum + a.amount, 0n);
  const order = allocations
    .map((a, i) => ({ a, i }))
    .sort((x, y) => Number((y.a.raw % 60n) - (x.a.raw % 60n)) || x.i - y.i);
  for (const { a } of order) {
    if (!remainder) break;
    a.amount++;
    remainder--;
  }
  return {
    minutes: end - minute(s.start),
    normalMinutes: allocations.reduce((n, a) => n + a.normalMinutes, 0),
    weekendMinutes: allocations.reduce((n, a) => n + a.weekendMinutes, 0),
    amount,
    allocations,
    segments,
  };
}
function audit(action, before, after) {
  return { at: new Date().toISOString(), action, before, after };
}
export function upsertShift(
  data,
  { id, start, end },
  rates = data.config.rates,
) {
  const next = structuredClone(data),
    old = next.shifts.find((s) => s.id === id),
    s = {
      id: id || uid(),
      start,
      end,
      rates: { ...(old?.rates || rates) },
      history: old?.history || [],
    };
  validateShift(s);
  if (
    next.shifts.some((r) => r.id !== s.id && r.start === start && r.end === end)
  )
    throw Error("Ya existe una guardia con esas fechas y horas");
  ensureCoverage(next, minute(start), minute(end));
  s.history = [
    ...s.history,
    audit(
      old ? "Edición de guardia" : "Registro manual",
      old ? { ...old, history: undefined } : null,
      { ...s, history: undefined },
    ),
  ];
  if (old) next.shifts[next.shifts.indexOf(old)] = s;
  else next.shifts.push(s);
  validateData(next);
  return next;
}
export function rerateShift(data, id, rates) {
  validateRates(rates);
  const next = structuredClone(data),
    s = next.shifts.find((s) => s.id === id);
  if (!s) throw Error("Guardia inexistente");
  const before = { ...s, history: undefined };
  s.rates = { ...rates };
  s.history.push(
    audit("Recálculo de tarifas confirmado", before, {
      ...s,
      history: undefined,
    }),
  );
  return next;
}
export function removeShift(data, id) {
  const next = structuredClone(data),
    s = next.shifts.find((s) => s.id === id);
  if (!s) throw Error("Guardia inexistente");
  next.shifts = next.shifts.filter((s) => s.id !== id);
  next.history.push(audit("Eliminación confirmada de guardia", s, null));
  return next;
}
export function editPeriod(
  data,
  id,
  { start, end, billFrom, billTo },
  now = paraguayNow(),
) {
  const next = structuredClone(data),
    i = next.periods.findIndex((p) => p.id === id);
  if (i < 0) throw Error("Período inexistente");
  const before = structuredClone(next.periods),
    p = next.periods[i],
    previous = next.periods[i - 1],
    following = next.periods[i + 1];
  if (!previous || !following)
    throw Error(
      "Extiende un período anterior y posterior antes de ajustar este límite",
    );
  if (
    minute(start) <= minute(previous.start) ||
    minute(end) >= minute(following.end)
  )
    throw Error(
      "El ajuste debe dejar positivos los períodos vecinos; ajusta primero sus otros límites",
    );
  p.start = start;
  p.end = end;
  p.billing = { from: billFrom, to: billTo };
  previous.end = start;
  following.start = end;
  validateData(next);
  const changed = next.periods.filter(
    (p, j) => JSON.stringify(p) !== JSON.stringify(before[j]),
  );
  const affects = next.shifts.filter((s) =>
    changed.some(
      (p) =>
        minute(s.start) <
          Math.max(
            minute(p.end),
            minute(before.find((b) => b.id === p.id).end),
          ) &&
        minute(s.end) >
          Math.min(
            minute(p.start),
            minute(before.find((b) => b.id === p.id).start),
          ),
    ),
  ).length;
  const needsConfirmation =
    changed.some(
      (p) => minute(before.find((b) => b.id === p.id).end) <= minute(now),
    ) || affects > 0;
  for (const p of changed)
    p.history.push(
      audit(
        "Ajuste individual de período confirmado",
        { ...before.find((b) => b.id === p.id), history: undefined },
        { ...p, history: undefined },
      ),
    );
  next.userConfigured = true;
  return { data: next, affects, needsConfirmation };
}
export function changeSettings(data, config, now = paraguayNow()) {
  validateRates(config.rates);
  validatePattern(config.pattern);
  const next = structuredClone(data),
    point = minute(now);
  ensureCoverage(next, point, point + 1);
  const current = findPeriod(next, point),
    firstIndex = next.periods.indexOf(current) + 1;
  const oldFuture = next.periods.slice(firstIndex),
    start = current.end;
  let cursor = start;
  // Solo períodos posteriores al actual. Las ventanas informativas no mueven límites.
  const boundariesChanged =
    config.pattern.day !== next.config.pattern.day ||
    config.pattern.time !== next.config.pattern.time;
  const invoiceChanged =
    config.pattern.billStart !== next.config.pattern.billStart ||
    config.pattern.billEnd !== next.config.pattern.billEnd;
  const customFuture = oldFuture.some((p) =>
    p.history.some((h) => h.action.startsWith("Ajuste individual")),
  );
  if (boundariesChanged) {
    const rebuilt = [];
    for (let i = 0; i < Math.max(12, oldFuture.length); i++) {
      const end = nextBoundary(cursor, config.pattern),
        p = makePeriod(cursor, end, config.pattern);
      if (oldFuture[i]) {
        p.id = oldFuture[i].id;
        p.history = [
          ...oldFuture[i].history,
          audit(
            "Patrón futuro confirmado",
            { ...oldFuture[i], history: undefined },
            { ...p, history: undefined },
          ),
        ];
      }
      rebuilt.push(p);
      cursor = end;
    }
    next.periods.splice(
      firstIndex,
      next.periods.length - firstIndex,
      ...rebuilt,
    );
    const max = next.shifts.reduce((n, s) => Math.max(n, minute(s.end)), point);
    ensureCoverage(next, point, max);
  } else if (invoiceChanged) {
    for (const p of next.periods.slice(firstIndex)) {
      const before = { ...p, history: undefined };
      p.pattern = {
        ...p.pattern,
        billStart: config.pattern.billStart,
        billEnd: config.pattern.billEnd,
      };
      p.billing = billing(p.end, config.pattern);
      p.history.push(
        audit("Ventana futura confirmada", before, {
          ...p,
          history: undefined,
        }),
      );
    }
  }
  const affects = next.shifts.filter(
    (s) => minute(s.end) > minute(start),
  ).length;
  next.history.push(
    audit("Configuración privada actualizada", next.config, config),
  );
  next.config = structuredClone(config);
  next.userConfigured = true;
  validateData(next);
  return {
    data: next,
    affects,
    needsConfirmation:
      (boundariesChanged && (affects > 0 || customFuture)) ||
      (invoiceChanged && customFuture),
    boundariesChanged,
    firstFuture: findPeriod(next, minute(start)),
  };
}
export function periodSummary(data, p) {
  const rows = [];
  let minutes = 0,
    amount = 0n;
  for (const s of data.shifts) {
    if (minute(s.start) >= minute(p.end) || minute(s.end) <= minute(p.start))
      continue;
    const calculated = calculateShift(s, data.periods),
      allocation = calculated.allocations.find((a) => a.periodId === p.id);
    if (allocation) {
      rows.push({ shift: s, calculated, ...allocation });
      minutes += allocation.minutes;
      amount += allocation.amount;
    }
  }
  rows.sort((a, b) => b.shift.start.localeCompare(a.shift.start));
  return { rows, count: rows.length, minutes, amount };
}
export function mergePrivateData(current, incoming) {
  validateData(incoming);
  if (
    !current ||
    (!current.shifts.length &&
      !current.userConfigured &&
      !current.history.length)
  )
    return {
      data: structuredClone(incoming),
      added: incoming.shifts.length,
      skipped: 0,
    };
  validateData(current);
  const next = structuredClone(current);
  for (const p of incoming.periods) {
    const overlap = next.periods.filter(
      (q) => minute(p.start) < minute(q.end) && minute(p.end) > minute(q.start),
    );
    if (
      overlap.length &&
      !(
        overlap.length === 1 &&
        p.start === overlap[0].start &&
        p.end === overlap[0].end &&
        p.billing.from === overlap[0].billing.from &&
        p.billing.to === overlap[0].billing.to
      )
    )
      throw Error(
        "Los períodos privados del respaldo difieren de los locales. No se ha sobrescrito ni importado nada.",
      );
    if (!overlap.length) next.periods.push(structuredClone(p));
  }
  next.periods.sort((a, b) => a.start.localeCompare(b.start));
  let added = 0,
    skipped = 0;
  for (const s of incoming.shifts) {
    if (
      next.shifts.some(
        (r) => r.id === s.id || (r.start === s.start && r.end === s.end),
      )
    ) {
      skipped++;
      continue;
    }
    next.shifts.push(structuredClone(s));
    added++;
  }
  next.history.push(
    audit("Combinación de respaldo privado", null, { added, skipped }),
  );
  validateData(next);
  return { data: next, added, skipped };
}
