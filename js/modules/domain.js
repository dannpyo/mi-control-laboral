export const TYPES = {
  normal: "Jornada habitual",
  "double-omission": "Doble omisión",
  "holiday-free": "Feriado libre",
  "holiday-work": "Feriado trabajado",
  permission: "Permiso",
  vacation: "Vacaciones",
  medical: "Reposo médico",
  justified: "Ausencia justificada",
  unjustified: "Ausencia injustificada",
  swap: "Cambio de guardia",
  pending: "Jornada pendiente de revisión",
};
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s) => new Date(`${s}T12:00:00`);
export const minutes = (s) =>
  Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
export function period(date) {
  const d = parseDate(date);
  const offset = d.getDate() < 16 ? -1 : 0;
  return {
    start: localDate(new Date(d.getFullYear(), d.getMonth() + offset, 16)),
    end: localDate(new Date(d.getFullYear(), d.getMonth() + offset + 1, 15)),
  };
}
export function defaults() {
  return {
    startDate: localDate(),
    holidays: [],
    normalTolerance: 15,
    rainTolerance: 60,
    links: [
      { id: "1", name: "Vínculo 1 DGVS", day: 3, start: "07:30", end: "19:30" },
      { id: "2", name: "Vínculo 2 DGVS", day: 4, start: "07:30", end: "19:30" },
      { id: "3", name: "Vínculo 3 HGI", day: 0, start: "07:00", end: "19:00" },
    ],
  };
}
export const key = (date, link) => `${date}|${link}`;
export function blank(date, link, config) {
  const schedule = config.links.find((l) => l.id === link);
  return {
    id: key(date, link),
    date,
    link,
    type: (config.holidays || []).includes(date) ? "holiday-free" : "normal",
    entry: "",
    exit: "",
    officialEntry: "pending",
    officialExit: "pending",
    rain: false,
    lateState: "unjustified",
    earlyState: "unjustified",
    notes: "",
    closed: false,
    schedule: {
      start: schedule.start,
      end: schedule.end,
      normalTolerance: config.normalTolerance,
      rainTolerance: config.rainTolerance,
    },
    history: [],
  };
}
export function assessment(r, config, now = new Date()) {
  const l = config.links.find((l) => l.id === r.link),
    s = r.schedule || {
      ...l,
      normalTolerance: config.normalTolerance,
      rainTolerance: config.rainTolerance,
    };
  const future = r.date > localDate(now),
    exempt = [
      "holiday-free",
      "permission",
      "vacation",
      "medical",
      "justified",
      "unjustified",
      "swap",
    ].includes(r.type);
  const late =
    !!r.entry &&
    minutes(r.entry) >
      minutes(s.start) + (r.rain ? s.rainTolerance : s.normalTolerance);
  const early = !!r.exit && minutes(r.exit) < minutes(s.end);
  const elapsed =
    r.date < localDate(now) ||
    (r.date === localDate(now) &&
      now.getHours() * 60 +
        now.getMinutes() +
        now.getSeconds() / 60 +
        now.getMilliseconds() / 60000 >
        minutes(s.end));
  const countable = !future && !exempt;
  return {
    future,
    late: countable && late,
    early: countable && early,
    // Compatibilidad sin reescribir datos: solo "justified" excluye del cómputo.
    // El antiguo "pending" equivale a no justificada bajo la nueva regla.
    lateJustified: countable && late && r.lateState === "justified",
    earlyJustified: countable && early && r.earlyState === "justified",
    lateMinutes: countable && late ? minutes(r.entry) - minutes(s.start) : 0,
    earlyMinutes: countable && early ? minutes(s.end) - minutes(r.exit) : 0,
    lateCount: countable && late && r.lateState !== "justified" ? 1 : 0,
    earlyCount: countable && early && r.earlyState !== "justified" ? 1 : 0,
    omissionDetected:
      countable && elapsed
        ? r.entry || r.exit
          ? Number(!r.entry) + Number(!r.exit)
          : r.type === "double-omission" || legacyDoubleOmission(r)
            ? 2
            : 0
        : 0,
    omissionJustified: r.omissionJustified === true,
    omissions:
      countable && elapsed && !r.omissionJustified
        ? r.entry || r.exit
          ? Number(!r.entry) + Number(!r.exit)
          : r.type === "double-omission" || legacyDoubleOmission(r)
            ? 2
            : 0
        : 0,
    possibleAbsence:
      countable &&
      elapsed &&
      !r.entry &&
      !r.exit &&
      r.type !== "double-omission" &&
      !legacyDoubleOmission(r),
    pending: false,
    workedMinutes:
      !future && r.entry && r.exit
        ? Math.max(0, minutes(r.exit) - minutes(r.entry))
        : 0,
  };
}
export function fine(n, type) {
  return type === "omission"
    ? n > 5
      ? "Revisión normativa"
      : Math.max(0, n - 1)
    : n < 3
      ? 0
      : Math.min(5, n - 2);
}
function legacyDoubleOmission(r) {
  // Una doble omisión previamente confirmada conserva su clasificación histórica.
  return (
    r.closed === true &&
    r.officialEntry === "missing" &&
    r.officialExit === "missing"
  );
}
export function effectiveRecord(date, link, records, config) {
  const saved = records.find((r) => r.date === date && r.link === link);
  if (saved) return saved;
  const l = config.links.find((l) => l.id === link);
  if (date < config.startDate || l.day !== parseDate(date).getDay())
    return null;
  return { ...blank(date, link, config), virtual: true };
}
export function periodRecords(records, config, link, p) {
  const rows = records.filter(
    (r) => r.link === link && r.date >= p.start && r.date <= p.end,
  );
  const known = new Set(rows.map((r) => r.date));
  for (
    const cursor = parseDate(p.start);
    localDate(cursor) <= p.end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const date = localDate(cursor);
    if (known.has(date)) continue;
    const row = effectiveRecord(date, link, records, config);
    if (row) rows.push(row);
  }
  return rows;
}
// Derivados de solo lectura: no añaden campos ni migran registros de v1.0.
export const isWork = (r) =>
  ["normal", "holiday-work", "pending", "double-omission"].includes(r.type);
export function applicableLinks(date, records, config, filter = "all") {
  return config.links.filter(
    (l) =>
      (filter === "all" || filter === l.id) &&
      (l.day === parseDate(date).getDay() ||
        records.some((r) => r.date === date && r.link === l.id)),
  );
}
export function calendarState(record, config, now = new Date()) {
  if (!record) return "scheduled";
  const a = assessment(record, config, now);
  if (a.future)
    return !["normal", "holiday-work", "pending"].includes(record.type)
      ? "special"
      : "scheduled";
  if (
    record.type === "unjustified" ||
    a.lateCount ||
    a.earlyCount ||
    a.omissions
  )
    return "incident";
  if (!isWork(record)) return "special";
  if (a.possibleAbsence || !record.entry || !record.exit) return "review";
  return "validated";
}

export function formatMinutes(total) {
  if (!Number.isInteger(total))
    throw Error("El tiempo debe expresarse en minutos enteros");
  const absolute = Math.abs(total);
  return `${total < 0 ? "−" : ""}${Math.floor(absolute / 60)} h ${String(absolute % 60).padStart(2, "0")} min`;
}
export function stats(records, config, link, p, now = new Date()) {
  const out = {
    scheduled: 0,
    complete: 0,
    incomplete: 0,
    closed: 0,
    validated: 0,
    exceptional: 0,
    saved: 0,
    late: 0,
    early: 0,
    lateDetected: 0,
    lateJustified: 0,
    earlyDetected: 0,
    earlyJustified: 0,
    omissions: 0,
    omissionsDetected: 0,
    omissionsJustified: 0,
    possibleAbsences: 0,
    pending: 0,
    personalMinutes: 0,
    scheduledMinutes: 0,
    comparableMinutes: 0,
    deltaMinutes: null,
    absences: 0,
    unrecorded: 0,
  };
  const schedule = config.links.find((l) => l.id === link);
  const rows = periodRecords(records, config, link, p);
  const known = new Map(rows.map((r) => [r.date, r]));
  for (const r of rows) {
    const a = assessment(r, config, now);
    if (a.future) continue;
    out.saved += Number(!r.virtual);
    out.closed += Number(r.closed);
    out.validated += Number(calendarState(r, config, now) === "validated");
    out.exceptional += Number(
      !r.virtual && parseDate(r.date).getDay() !== schedule.day,
    );
    if (isWork(r)) {
      if (r.entry && r.exit) {
        out.complete++;
        out.personalMinutes += a.workedMinutes;
        out.comparableMinutes +=
          minutes(r.schedule.end) - minutes(r.schedule.start);
      } else if (!r.virtual) out.incomplete++;
    }
    out.lateDetected += Number(a.late);
    out.lateJustified += Number(a.lateJustified);
    out.earlyDetected += Number(a.early);
    out.earlyJustified += Number(a.earlyJustified);
    out.late += a.lateCount;
    out.early += a.earlyCount;
    out.omissions += a.omissions;
    out.omissionsDetected += a.omissionDetected;
    out.omissionsJustified += a.omissionJustified ? a.omissionDetected : 0;
    out.possibleAbsences += Number(a.possibleAbsence);
    out.pending += Number(a.pending || (isWork(r) && (!r.entry || !r.exit)));
    out.absences += Number(r.type === "unjustified");
  }
  // Programación del período completo; el inicio de seguimiento limita solo la revisión de vacíos.
  const cursor = parseDate(p.start);
  for (; localDate(cursor) <= p.end; cursor.setDate(cursor.getDate() + 1)) {
    const date = localDate(cursor),
      r = known.get(date);
    if (cursor.getDay() !== schedule.day) continue;
    if (r ? !isWork(r) && r.type !== "pending" : config.holidays.includes(date))
      continue;
    out.scheduled++;
    const expected = r?.schedule || schedule;
    out.scheduledMinutes += minutes(expected.end) - minutes(expected.start);
    if ((r && !r.virtual) || date < config.startDate || date > localDate(now))
      continue;
    if (
      date === localDate(now) &&
      now.getHours() * 60 +
        now.getMinutes() +
        now.getSeconds() / 60 +
        now.getMilliseconds() / 60000 <=
        minutes(expected.end)
    )
      continue;
    out.unrecorded++;
  }
  if (out.complete)
    out.deltaMinutes = out.personalMinutes - out.comparableMinutes;
  return out;
}
export function validDate(s) {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(parseDate(s).valueOf()) &&
    localDate(parseDate(s)) === s
  );
}
const time = (s) =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function validateConfig(c) {
  if (
    !Array.isArray(c?.holidays) ||
    c.holidays.some((d) => !validDate(d)) ||
    new Set(c.holidays).size !== c.holidays.length
  )
    throw Error("Fechas de feriados inválidas");
  if (
    !c ||
    !validDate(c.startDate) ||
    ![c.normalTolerance, c.rainTolerance].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 180,
    ) ||
    c.rainTolerance < c.normalTolerance ||
    !Array.isArray(c.links) ||
    c.links.length !== 3
  )
    throw Error("Configuración inválida");
  c.links.forEach((l, i) => {
    if (
      l.id !== String(i + 1) ||
      typeof l.name !== "string" ||
      !l.name.trim() ||
      l.name.length > 80 ||
      !Number.isInteger(l.day) ||
      l.day < 0 ||
      l.day > 6 ||
      !time(l.start) ||
      !time(l.end) ||
      minutes(l.end) <= minutes(l.start)
    )
      throw Error("Horario inválido (solo jornadas dentro del mismo día)");
  });
}
export function validateRecord(r) {
  if (
    r &&
    r.omissionJustified !== undefined &&
    typeof r.omissionJustified !== "boolean"
  )
    throw Error("Justificación de omisión inválida");
  if (
    !r ||
    !validDate(r.date) ||
    !["1", "2", "3"].includes(r.link) ||
    r.id !== key(r.date, r.link) ||
    !Object.hasOwn(TYPES, r.type) ||
    ![r.entry, r.exit].every((s) => s === "" || time(s)) ||
    typeof r.notes !== "string" ||
    r.notes.length > 10000 ||
    typeof r.rain !== "boolean" ||
    typeof r.closed !== "boolean" ||
    !["pending", "marked", "missing"].includes(r.officialEntry) ||
    !["pending", "marked", "missing"].includes(r.officialExit) ||
    ![r.lateState, r.earlyState].every((s) =>
      ["pending", "justified", "unjustified"].includes(s),
    ) ||
    !Array.isArray(r.history) ||
    r.history.length > 10000
  )
    throw Error("Registro inválido");
  if (r.entry && r.exit && minutes(r.exit) < minutes(r.entry))
    throw Error("La salida no puede ser anterior a la entrada");
  const s = r.schedule;
  if (
    !s ||
    !time(s.start) ||
    !time(s.end) ||
    minutes(s.end) <= minutes(s.start) ||
    ![s.normalTolerance, s.rainTolerance].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 180,
    ) ||
    s.rainTolerance < s.normalTolerance
  )
    throw Error("Horario del registro inválido");
  for (const h of r.history)
    if (
      !h ||
      typeof h.at !== "string" ||
      !Number.isFinite(Date.parse(h.at)) ||
      typeof h.action !== "string" ||
      typeof h.before !== "object" ||
      typeof h.after !== "object"
    )
      throw Error("Historial inválido");
}
