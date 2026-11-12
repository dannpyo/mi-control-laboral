import { createBackupManager, backupDocument } from "./data/manager.js";
import { backupControls, createBackupUI } from "./data/ui.js";
import {
  THEME_KEY,
  EXPECTED_ZONE,
  clockText,
  defaultLink,
  readTheme,
} from "./modules/presentation.js";
import {
  isWork,
  applicableLinks,
  calendarState,
  TYPES,
  localDate,
  parseDate,
  period,
  defaults,
  key,
  blank,
  assessment,
  stats,
  fine,
  validateConfig,
  validateRecord,
} from "./modules/domain.js";
import {
  getRecords,
  getConfig,
  saveConfig,
  saveRecord,
  importBackup,
  getSnapshot,
} from "./storage/db.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateLabel = (s) =>
  parseDate(s).toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
let config,
  records = [],
  section = "home",
  selectedDate = localDate(),
  month = localDate().slice(0, 7),
  filterLink = "all",
  calendarLink = "all",
  homeLink = null,
  filterDate = localDate(),
  editing = null,
  busy = false;
const notice = (message, error = false) => {
  const el =
    error && $("#editor").open ? $("#editor-status") : $("#app-status");
  el.hidden = false;
  el.className = error ? "app-status error" : "app-status";
  el.textContent = message;
  if (el.id === "app-status") {
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Cerrar aviso";
    close.className = "secondary";
    close.onclick = () => {
      el.hidden = true;
    };
    el.append(close);
  }
};
const linkName = (id) => config.links.find((l) => l.id === id).name;
const recordFor = (date, id) => records.find((r) => r.id === key(date, id));
function shortStatus(r) {
  if (!r) return "Sin registrar";
  if (r.date > localDate()) return "Programada";
  if (!isWork(r)) return TYPES[r.type];
  const a = assessment(r, config);
  const incomplete =
    !r.entry && !r.exit
      ? "Sin registrar"
      : !r.entry
        ? "Falta entrada"
        : !r.exit
          ? "Falta salida"
          : "";
  return (
    [
      incomplete,
      a.late
        ? `Llegada tardía · ${a.lateMinutes} min de retraso${a.lateJustified ? " · justificada" : ""}`
        : "",
      a.early
        ? `Salida anticipada · ${a.earlyMinutes} min${a.earlyJustified ? " · justificada" : ""}`
        : "",
      a.omissions ? `${a.omissions} omisión(es) oficial(es) confirmada(s)` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Registrada"
  );
}
const badge = shortStatus;
function recordCard(date, id) {
  const r = recordFor(date, id),
    l = config.links.find((l) => l.id === id),
    state = r
      ? calendarState(r, config)
      : config.holidays.includes(date)
        ? "special"
        : "scheduled";
  return `<article class="card record-card"><div class="card-top"><h3>${esc(l.name)}</h3><button class="text-button" data-edit="${id}" data-date="${date}">Editar</button></div><div class="record-times"><span>Entrada <strong>${r?.entry || "—"}</strong></span><span>Salida <strong>${r?.exit || "—"}</strong></span></div><p class="status ${state}">${esc(r ? shortStatus(r) : config.holidays.includes(date) ? "Feriado libre" : "Sin registrar")}</p>${l.day !== parseDate(date).getDay() ? '<span class="muted">Jornada excepcional</span>' : ""}</article>`;
}
function currentHomeLink() {
  return (
    homeLink ??
    (defaultLink(config.links) ||
      records.find((r) => r.date === localDate())?.link ||
      "")
  );
}
const incidenceRows = (s) => [
  ["Tardanzas", s.late, "late"],
  ["Salidas anticipadas", s.early, "early"],
  ["Omisiones oficiales", s.omissions, "omission"],
];
function counterGrid(s) {
  return `<div class="incidence-grid">${incidenceRows(s)
    .map(
      ([label, n, type]) =>
        `<div class="incidence" aria-label="${label}: ${n}"><strong>${type === "omission" ? `${n}<small>/1</small>` : n}</strong><span>${label}</span></div>`,
    )
    .join("")}</div>`;
}
function sanctionText(label, n, type) {
  const value = fine(n, type);
  return value === 0
    ? ""
    : `${label}: ${n} · ${typeof value === "number" ? `${value} día(s) de salario` : value}`;
}
function home() {
  const today = localDate(),
    id = currentHomeLink(),
    l = config.links.find((l) => l.id === id),
    r = l && recordFor(today, id),
    schedule = r?.schedule || l,
    p = period(today);
  const s = l ? stats(records, config, id, p) : null;
  const alert =
    s &&
    incidenceRows(s)
      .map(([label, n, type]) => sanctionText(label, n, type))
      .filter(Boolean)
      .join(" · ");
  const recent = records
    .filter((r) => r.date <= today && (!id || r.link === id))
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.link.localeCompare(b.link),
    )
    .slice(0, 5);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `<div class="page-heading"><h1>Inicio</h1><span>${new Date().toLocaleDateString("es-PY", { weekday: "short", day: "numeric", month: "short" })}</span></div>
    <section class="card punch-card"><div class="card-top"><span class="eyebrow">TU JORNADA</span><span class="personal-label">Registro personal</span></div><label class="sr-only" for="quick-link">Vínculo de hoy</label><select id="quick-link"><option value="">Elegir vínculo</option>${config.links.map((link) => `<option value="${link.id}" ${link.id === id ? "selected" : ""}>${esc(link.name)}${link.day !== new Date().getDay() ? " · excepcional" : ""}</option>`).join("")}</select>
    <p class="schedule">${l ? `${schedule.start} — ${schedule.end}${l.day !== new Date().getDay() ? " · Excepcional" : ""}` : "Sin jornada programada para hoy"}</p>
    <time id="live-clock" class="digital-clock" aria-label="Hora local del dispositivo">${clockText()}</time><p class="timezone">${zone === EXPECTED_ZONE ? EXPECTED_ZONE : `${esc(zone)} · prevista ${EXPECTED_ZONE}`}</p>
    <div class="punch-times"><div><span>Entrada</span><strong id="saved-entry">${r?.entry || "— — : — —"}</strong></div><div><span>Salida</span><strong id="saved-exit">${r?.exit || "— — : — —"}</strong></div></div>
    ${r ? `<p class="status ${calendarState(r, config)}">${esc(shortStatus(r))}</p>` : ""}<div class="punch-actions"><button data-mark="entry" ${!l || r?.entry ? "disabled" : ""}>Marcar entrada</button><button data-mark="exit" class="secondary" ${!l || r?.exit ? "disabled" : ""}>Marcar salida</button></div>
    <button id="manual" class="text-button" ${!l ? "disabled" : ""}>Corregir o ingresar horario</button><p class="personal-note">No sustituye al reloj biométrico oficial.</p></section>
    ${s ? `<section class="card current-period"><div class="card-top"><h2>Este período</h2><span>${dateLabel(p.start)} – ${dateLabel(p.end)}</span></div>${counterGrid(s)}${alert ? `<p class="compact-alert sanction">${esc(alert)}</p>` : incidenceRows(s).some(([, n]) => n >= 2) ? '<p class="compact-alert preventive">Segunda incidencia: revisa el resumen antes de alcanzar el próximo umbral.</p>' : ""}</section>` : ""}
    <section class="recent"><h2>Registros recientes</h2>${recent.length ? `<ul>${recent.map((r) => `<li><button class="recent-row" data-edit="${r.link}" data-date="${r.date}"><span><strong>${dateLabel(r.date)} · ${esc(linkName(r.link))}</strong><small>${esc(shortStatus(r))}</small></span><span>${r.entry || "—"}<small>${r.exit || "—"}</small></span></button></li>`).join("")}</ul>` : '<p class="empty">Todavía no hay registros para este vínculo.</p>'}</section>`;
}
function calendar() {
  const first = parseDate(`${month}-01`),
    count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const linksForDate = (d) => applicableLinks(d, records, config, calendarLink);
  const cells = Array(first.getDay()).fill("<span></span>");
  for (let n = 1; n <= count; n++) {
    const date = `${month}-${String(n).padStart(2, "0")}`;
    const links = linksForDate(date);
    const descriptions = links.map((l) => {
      const r = recordFor(date, l.id);
      return `${l.name}: ${r ? badge(r) : config.holidays.includes(date) ? "Feriado libre" : "Programada sin registro"}`;
    });
    const markers = links
      .map((l) => {
        const r = recordFor(date, l.id),
          state = r
            ? calendarState(r, config)
            : config.holidays.includes(date)
              ? "special"
              : "scheduled";
        return `<span class="link-marker ${state}" data-link="${l.id}" aria-hidden="true">${l.id}</span>`;
      })
      .join("");
    cells.push(
      `<button class="day ${date === selectedDate ? "selected" : ""}" data-day="${date}" aria-pressed="${date === selectedDate}" aria-label="${dateLabel(date)}${date === localDate() ? ", hoy" : ""}: ${esc(descriptions.join("; ") || "Sin jornada")}"><span>${n}${date === localDate() ? " •" : ""}</span><span class="day-markers">${markers}</span></button>`,
    );
  }
  const selected = linksForDate(selectedDate);
  return `<h1>Calendario</h1><div class="filters"><label>Mes<input type="month" id="month" value="${month}" required></label><label>Vínculo del calendario<select id="calendar-link"><option value="all">Todos</option>${config.links.map((l) => `<option value="${l.id}" ${calendarLink === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label></div>
    <div class="calendar-legend" aria-label="Leyenda"><span class="validated">Correcto</span><span class="review">Pendiente</span><span class="incident">Incidencia</span><span class="scheduled">Programada</span><span class="special">Especial</span></div>

    <div class="calendar">${days.map((d) => `<span class="weekday">${d.slice(0, 2)}</span>`).join("")}${cells.join("")}</div>
    <h2>${dateLabel(selectedDate)}</h2>${config.holidays.includes(selectedDate) ? '<p class="special-date">Feriado: libre salvo excepción registrada.</p>' : ""}
    ${selected.length ? selected.map((l) => recordCard(selectedDate, l.id)).join("") : '<p class="empty">Sin jornada programada ni excepcional para esta selección.</p>'}
    <button id="exceptional" class="secondary">Registrar jornada excepcional</button>
    <div id="exceptional-picker" hidden><label>Vínculo para esta fecha<select id="exceptional-link">${config.links.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select></label><button id="open-exceptional">Abrir jornada seleccionada</button><p class="muted">Solo se guarda esta fecha; no cambia la programación permanente.</p></div>`;
}
function filters() {
  return `<div class="filters"><label>Fecha del período<input type="date" id="filter-date" value="${filterDate}" required></label><label>Vínculo<select id="filter-link"><option value="all">Todos</option>${config.links.map((l) => `<option value="${l.id}" ${l.id === filterLink ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label></div>`;
}
function summary() {
  const p = period(filterDate);
  const cards = config.links
    .filter((l) => filterLink === "all" || filterLink === l.id)
    .map((l) => {
      const s = stats(records, config, l.id, p),
        rows = incidenceRows(s),
        sanctions = rows
          .map(([label, n, type]) => sanctionText(label, n, type))
          .filter(Boolean);
      const incidents = records
        .filter(
          (r) =>
            r.link === l.id &&
            r.date >= p.start &&
            r.date <= p.end &&
            r.date <= localDate(),
        )
        .map((r) => ({ r, a: assessment(r, config) }))
        .filter(({ a }) => a.late || a.early || a.omissions)
        .sort((a, b) => b.r.date.localeCompare(a.r.date));
      return `<article class="card summary-card" data-summary-link="${l.id}"><h2>${esc(l.name)}</h2>${counterGrid(s)}<p class="omission-balance">Omisión permitida: <strong>${Math.max(0, 1 - s.omissions)}/1 disponible</strong></p>
      ${sanctions.length ? sanctions.map((text) => `<p class="compact-alert sanction">${esc(text)}</p>`).join("") : '<p class="no-sanction">Sin sanciones estimadas</p>'}
      ${!sanctions.length && rows.some(([, n]) => n >= 2) ? '<p class="compact-alert preventive">Segunda incidencia · alerta preventiva</p>' : ""}
      <details><summary>Ver fechas de incidencia${incidents.length ? ` (${incidents.length})` : ""}</summary><p class="muted">Llegadas tardías: ${s.lateDetected} detectadas · ${s.lateJustified} justificadas · ${s.late} computables.<br>Salidas anticipadas: ${s.earlyDetected} detectadas · ${s.earlyJustified} justificadas · ${s.early} computables.</p>${incidents.length ? `<ul class="incident-dates">${incidents.map(({ r, a }) => `<li><button class="text-button" data-edit="${r.link}" data-date="${r.date}">${dateLabel(r.date)} · ${[a.late ? `Llegada tardía · ${a.lateMinutes} min${a.lateJustified ? " · justificada" : ""}` : "", a.early ? `Salida anticipada · ${a.earlyMinutes} min${a.earlyJustified ? " · justificada" : ""}` : "", a.omissions ? `${a.omissions} omisión(es) oficial(es)` : ""].filter(Boolean).join(" · ")}</button></li>`).join("")}</ul>` : '<p class="muted">No hay incidencias detectadas en este período.</p>'}</details></article>`;
    })
    .join("");
  return `<h1>Resumen</h1><div class="period-picker"><button id="period-prev" class="secondary" aria-label="Período anterior">‹</button><div><span>Período administrativo</span><strong>${dateLabel(p.start)} – ${dateLabel(p.end)}</strong></div><button id="period-next" class="secondary" aria-label="Período siguiente">›</button></div>${filters()}${cards}<p class="regulation-note">Normativa informativa configurada por el usuario, pendiente de verificación institucional. No constituye una decisión disciplinaria oficial.</p>`;
}
function settings() {
  return `<h1>Configuración</h1><form id="settings-form"><details class="card settings-group"><summary>Horarios e inicio del seguimiento</summary><p class="muted">Cambios aplicables a jornadas nuevas. Los registros existentes conservan su horario y tolerancia.</p><label>Inicio del seguimiento<input name="startDate" type="date" value="${config.startDate}" required aria-describedby="tracking-help"></label><p id="tracking-help" class="muted">Desde esta fecha se señalan jornadas programadas transcurridas sin registro para revisión. No genera faltas retroactivas, no cambia tus registros ni los períodos anteriores. Puedes cargar jornadas históricas manualmente: se cuentan solo en su período. La programación del período se muestra completa, incluso antes del seguimiento.</p>${config.links.map((l) => `<fieldset><legend>${esc(l.name)}</legend><label>Nombre<input name="name${l.id}" maxlength="80" value="${esc(l.name)}" required></label><label>Día<select name="day${l.id}">${days.map((d, i) => `<option value="${i}" ${l.day === i ? "selected" : ""}>${d}</option>`).join("")}</select></label><div class="filters"><label>Entrada<input type="time" name="start${l.id}" value="${l.start}" required></label><label>Salida<input type="time" name="end${l.id}" value="${l.end}" required></label></div></fieldset>`).join("")}</details><details class="card settings-group"><summary>Tolerancias</summary><label>Normal (minutos)<input type="number" name="normalTolerance" min="0" max="180" value="${config.normalTolerance}" required></label><label>Lluvia: total de minutos, no adicional<input type="number" name="rainTolerance" min="0" max="180" value="${config.rainTolerance}" required></label></details><details class="card settings-group"><summary>Feriados</summary><p>No se descarga un calendario externo. Introduce las fechas oficiales que correspondan. Son libres por defecto para los tres vínculos. En el calendario puedes cambiar una fecha y vínculo a «Feriado trabajado» u otra situación. Los registros ya guardados son excepciones y se conservan.</p><label>Fechas, una por línea (AAAA-MM-DD)<textarea name="holidays" rows="5" placeholder="2026-12-25">${esc(config.holidays.join("\n"))}</textarea></label></details><button type="submit">Guardar configuración</button></form><details class="card settings-group"><summary>Reglas de incidencia</summary><p class="muted">Configuración informativa pendiente de verificación institucional.</p><p>Una omisión oficial de entrada o salida permitida por vínculo y período. Solo se cuentan omisiones confirmadas en una jornada cerrada, una vez transcurrido su horario de salida.</p><p>Omisiones: 0–1 → 0 días; 2 → 1; 3 → 2; 4 → 3; 5 → 4; más de 5 → revisión normativa.</p><p>Tardanzas y salidas anticipadas, cada tipo por separado: 0–2 → 0 días; 3 → 1; 4 → 2; 5 → 3; 6 → 4; 7 o más → 5 días.</p><p>Las incidencias detectadas cuentan automáticamente salvo que marques su casilla de justificación. Una jornada sin marcaciones no se convierte en ausencia injustificada. Las jornadas futuras no suman incidencias. La ausencia injustificada se identifica, sin inventar una escala de sanción adicional.</p></details><section class="card"><h2>Datos y respaldos</h2>${backupControls()}</section>`;
}
function render() {
  $("#view").innerHTML = { home, calendar, summary, settings }[section]();
  document.querySelectorAll("[data-section]").forEach((b) => {
    b.disabled = false;
    b.classList.toggle("active", b.dataset.section === section);
    b.setAttribute(
      "aria-current",
      b.dataset.section === section ? "page" : "false",
    );
  });
  bind();
  if (section === "settings") {
    backupUI.refresh();
    backupUI.bindClear();
  }
}
function bind() {
  $("#quick-link")?.addEventListener("change", (e) => {
    homeLink = e.target.value;
    render();
  });

  $("#calendar-link")?.addEventListener("change", (e) => {
    calendarLink = e.target.value;
    render();
  });
  $("#exceptional")?.addEventListener("click", () => {
    $("#exceptional-picker").hidden = false;
    $("#exceptional-link").focus();
  });
  $("#open-exceptional")?.addEventListener("click", () =>
    openEditor(selectedDate, $("#exceptional-link").value),
  );
  for (const [id, delta] of [
    ["period-prev", -1],
    ["period-next", 1],
  ]) {
    $("#" + id)?.addEventListener("click", () => {
      const d = parseDate(period(filterDate).start);
      d.setMonth(d.getMonth() + delta);
      filterDate = localDate(d);
      render();
    });
  }

  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) => (b.onclick = () => openEditor(b.dataset.date, b.dataset.edit)),
    );
  $("#manual")?.addEventListener("click", () =>
    openEditor(localDate(), currentHomeLink()),
  );
  document.querySelectorAll("[data-day]").forEach(
    (b) =>
      (b.onclick = () => {
        selectedDate = b.dataset.day;
        render();
      }),
  );
  $("#month")?.addEventListener("change", (e) => {
    if (e.target.value) {
      month = e.target.value;
      selectedDate = `${month}-01`;
      render();
    }
  });
  $("#filter-date")?.addEventListener("change", (e) => {
    if (e.target.value) {
      filterDate = e.target.value;
      render();
    }
  });
  $("#filter-link")?.addEventListener("change", (e) => {
    filterLink = e.target.value;
    render();
  });
  document
    .querySelectorAll("[data-mark]")
    .forEach((b) => (b.onclick = () => run(() => mark(b.dataset.mark))));
  $("#settings-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    run(async () => {
      const f = new FormData(e.target),
        next = {
          ...config,
          startDate: f.get("startDate"),
          normalTolerance: Number(f.get("normalTolerance")),
          rainTolerance: Number(f.get("rainTolerance")),
          holidays: [
            ...new Set(f.get("holidays").split(/\s+/).filter(Boolean)),
          ],
          links: config.links.map((l) => ({
            ...l,
            name: f.get(`name${l.id}`).trim(),
            day: Number(f.get(`day${l.id}`)),
            start: f.get(`start${l.id}`),
            end: f.get(`end${l.id}`),
          })),
        };
      validateConfig(next);
      await saveConfig(next);
      void backupUI.automatic();
      config = next;
      render();
      notice("Configuración guardada.");
    });
  });
  $("#json-export")?.addEventListener("click", () =>
    run(() => exportData("json")),
  );
  $("#csv-export")?.addEventListener("click", () =>
    run(() => exportData("csv")),
  );
  $("#json-import")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file)
      run(async () => {
        if (file.size > 20 * 1024 * 1024)
          throw Error("El archivo supera 20 MB");
        const data = JSON.parse(await file.text());
        const restore = $("#restore-config").checked;
        const result = await importBackup(data, restore);
        if (restore) config = data.config;
        records = await getRecords();
        if (result.added || restore) void backupUI.automatic();
        render();
        notice(
          `Respaldo importado: ${result.added} nuevas; ${result.skipped} coincidentes conservadas.`,
        );
      });
  });
}
async function run(action) {
  if (busy) return;
  busy = true;
  try {
    await action();
  } catch (e) {
    notice(
      e.message === "Operación cancelada"
        ? "El registro cambió en otra pestaña. Cierra y vuelve a abrir la jornada antes de editar."
        : e.message || "No se pudo completar la operación",
      true,
    );
  } finally {
    busy = false;
  }
}
async function mark(field) {
  const date = localDate(),
    id = $("#quick-link").value;
  records = await getRecords();
  const existing = recordFor(date, id),
    r = existing ? structuredClone(existing) : blank(date, id, config);
  if (r[field])
    throw Error(
      `Ya hay ${field === "entry" ? "entrada" : "salida"} personal. Usa la edición para corregirla.`,
    );
  const l = config.links.find((l) => l.id === id);
  if (
    l.day !== new Date().getDay() &&
    !confirm(
      "Este vínculo no tiene jornada programada hoy. ¿Registrar una jornada excepcional?",
    )
  )
    return;
  if (
    [
      "holiday-free",
      "permission",
      "vacation",
      "medical",
      "justified",
      "unjustified",
      "swap",
      "pending",
    ].includes(r.type)
  )
    throw Error(
      "Esta jornada está exenta o pendiente. Edita primero su situación (por ejemplo, Feriado trabajado).",
    );
  r[field] = new Date().toTimeString().slice(0, 5);
  await saveRecord(
    r,
    `Marcación personal de ${field === "entry" ? "entrada" : "salida"} con hora del dispositivo`,
    existing?.revision || 0,
  );
  records = await getRecords();
  void backupUI.automatic();
  render();
  notice("Marcación personal guardada. No modifica el reloj biométrico.");
}
const stateOptions = (value) =>
  [
    ["pending", "Pendiente de confirmar"],
    ["marked", "Marcación oficial realizada"],
    ["missing", "Omisión oficial confirmada"],
  ]
    .map(
      ([v, label]) =>
        `<option value="${v}" ${v === value ? "selected" : ""}>${label}</option>`,
    )
    .join("");
function openEditor(date, id) {
  const existing = recordFor(date, id);
  editing = existing ? structuredClone(existing) : blank(date, id, config);
  const r = editing;
  $("#editor-content").innerHTML =
    `<div class="card-top"><h2 id="editor-title">Editar marcación</h2><button type="button" id="cancel-edit" class="icon-button" aria-label="Cerrar editor">×</button></div><p class="muted">Registro personal · ${esc(linkName(id))}</p>
    <div class="filters"><label>Fecha<input type="date" id="edit-date" value="${date}" required></label><label>Vínculo<select id="edit-link">${config.links.map((l) => `<option value="${l.id}" ${l.id === id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label></div>
    <div class="filters"><label>Entrada personal<input type="time" name="entry" value="${r.entry}"></label><label>Salida personal<input type="time" name="exit" value="${r.exit}"></label></div>
    <details id="more-options"><summary>Más opciones</summary>
    <label>Situación<select name="type">${Object.entries(TYPES)
      .map(
        ([value, label]) =>
          `<option value="${value}" ${value === r.type ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label>
    <label class="check"><input name="rain" type="checkbox" ${r.rain ? "checked" : ""}>Lluvia · ${r.schedule.rainTolerance} min totales</label>
    <label id="late-justification" class="check" hidden><input name="lateJustified" type="checkbox" ${r.lateState === "justified" ? "checked" : ""}>Llegada tardía justificada</label><label id="early-justification" class="check" hidden><input name="earlyJustified" type="checkbox" ${r.earlyState === "justified" ? "checked" : ""}>Salida anticipada justificada</label>
    <fieldset><legend>Marcación oficial</legend><label>Entrada oficial<select name="officialEntry">${stateOptions(r.officialEntry, true)}</select></label><label>Salida oficial<select name="officialExit">${stateOptions(r.officialExit, true)}</select></label><label class="check"><input name="closed" type="checkbox" ${r.closed ? "checked" : ""}>Jornada revisada / cerrada</label></fieldset>
    <details><summary>Horario de esta jornada</summary><div class="filters"><label>Inicio previsto<input type="time" name="scheduleStart" value="${r.schedule.start}" required></label><label>Fin previsto<input type="time" name="scheduleEnd" value="${r.schedule.end}" required></label></div><p class="muted">Tolerancia normal: ${r.schedule.normalTolerance} min.</p></details>
    <label>Observaciones<textarea name="notes" maxlength="10000" rows="3">${esc(r.notes)}</textarea></label>
    <details><summary>Historial de modificaciones (${r.history.length})</summary>${
      r.history
        .slice()
        .reverse()
        .map(
          (h) =>
            `<article class="audit"><strong>${esc(new Date(h.at).toLocaleString("es-PY"))} · ${esc(h.action)}</strong><pre>${esc(JSON.stringify({ antes: h.before, despues: h.after }, null, 2))}</pre></article>`,
        )
        .join("") || "<p>Sin modificaciones.</p>"
    }</details></details>
    <p class="editor-hint muted">Las incidencias se cuentan automáticamente salvo justificación en Más opciones. Cambiar fecha o vínculo abre otro registro; guarda antes de cambiar.</p><p id="editor-status" role="alert" hidden></p><button class="save-button" type="submit">Guardar jornada</button>`;
  // Vista previa local: reacciona a horas, lluvia y horario, sin guardar ni alterar historial.
  function updateJustificationVisibility() {
    const form = new FormData($("#record-form"));
    const preview = {
      ...editing,
      entry: form.get("entry"),
      exit: form.get("exit"),
      rain: form.has("rain"),
      type: form.get("type"),
      schedule: {
        ...editing.schedule,
        start: form.get("scheduleStart"),
        end: form.get("scheduleEnd"),
      },
    };
    const a = assessment(preview, config);
    $("#late-justification").hidden = !a.late;
    $("#early-justification").hidden = !a.early;
  }
  $("#record-form").oninput = updateJustificationVisibility;
  $("#record-form").onchange = updateJustificationVisibility;
  updateJustificationVisibility();
  $("#edit-date").onchange = (e) => {
    if (e.target.value) openEditor(e.target.value, $("#edit-link").value);
  };
  $("#edit-link").onchange = (e) =>
    openEditor($("#edit-date").value, e.target.value);
  $("#cancel-edit").onclick = () => $("#editor").close();
  if (!$("#editor").open) $("#editor").showModal();
}
$("#record-form").addEventListener("submit", (e) => {
  e.preventDefault();
  run(async () => {
    const f = new FormData(e.target),
      r = {
        ...editing,
        type: f.get("type"),
        entry: f.get("entry"),
        exit: f.get("exit"),
        rain: f.has("rain"),
        closed: f.has("closed"),
        lateState: f.has("lateJustified") ? "justified" : "unjustified",
        earlyState: f.has("earlyJustified") ? "justified" : "unjustified",
        officialEntry: f.get("officialEntry"),
        officialExit: f.get("officialExit"),
        notes: f.get("notes"),
        schedule: {
          ...editing.schedule,
          start: f.get("scheduleStart"),
          end: f.get("scheduleEnd"),
        },
      };
    validateRecord(r);
    await saveRecord(
      r,
      editing.revision ? "Edición de jornada" : "Ingreso manual",
      editing.revision || 0,
    );
    records = await getRecords();
    void backupUI.automatic();
    selectedDate = r.date;
    month = r.date.slice(0, 7);
    $("#editor").close();
    render();
    notice("Jornada guardada con historial de modificaciones.");
  });
});
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportData(format) {
  const snapshot = await getSnapshot(),
    fresh = snapshot.records;
  if (format === "json") {
    download(
      JSON.stringify(backupDocument(snapshot), null, 2),
      "application/json",
      `mi-control-laboral-${localDate()}.json`,
    );
    await backupManager.noteManualExport().catch(() => {});
    await backupUI.refresh();
  } else {
    const columns = [
      "date",
      "link",
      "type",
      "entry",
      "exit",
      "officialEntry",
      "officialExit",
      "rain",
      "lateState",
      "earlyState",
      "closed",
      "notes",
    ];
    const cell = (v) => {
      let s = String(v ?? "");
      if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    download(
      "\uFEFF" +
        [
          columns.map(cell).join(","),
          ...fresh
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => columns.map((k) => cell(r[k])).join(",")),
        ].join("\r\n"),
      "text/csv;charset=utf-8",
      `mi-control-laboral-${localDate()}.csv`,
    );
  }
  notice("Exportación preparada. Guarda el archivo en un lugar seguro.");
}
const backupManager = createBackupManager();
const backupUI = createBackupUI(backupManager, {
  notice,
  manualExport: async (snapshot) => {
    download(
      JSON.stringify(backupDocument(snapshot), null, 2),
      "application/json",
      `mi-control-laboral-${localDate()}.json`,
    );
    await backupManager.noteManualExport().catch(() => {});
  },
  onCleared: async () => {
    records = await getRecords();
    render();
    await backupUI.refresh();
  },
});
document.querySelectorAll("[data-section]").forEach(
  (b) =>
    (b.onclick = () => {
      section = b.dataset.section;
      render();
      window.scrollTo(0, 0);
      $("#view").focus();
    }),
);
let theme = "dark";
try {
  theme = readTheme(window.localStorage);
} catch {}
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content =
    theme === "light" ? "#F8FAFC" : "#0B0F19";
  $("#theme-toggle").setAttribute(
    "aria-label",
    theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
  );
}
applyTheme();
$("#theme-toggle").onclick = () => {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme();
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    notice("El navegador no permite guardar la apariencia.", true);
  }
};
async function init() {
  try {
    config = (await getConfig()) || defaults();
    validateConfig(config);
    if (!(await getConfig())) await saveConfig(config);
    records = await getRecords();
    render();
    // Reabrir solo consulta permisos; nunca solicita acceso sin acción del usuario.
    void backupManager
      .status()
      .then((backupStatus) => {
        if (
          backupStatus.prefs.enabled &&
          backupStatus.state === "pendiente" &&
          !backupStatus.prefs.pausedAfterClear
        )
          void backupUI.automatic();
      })
      .catch(() => {});
  } catch (e) {
    $("#view").innerHTML =
      "<h1>No se pudo abrir el almacenamiento</h1><p>No registres datos hasta resolver el acceso a IndexedDB. Revisa el modo privado o el espacio disponible y vuelve a abrir la aplicación.</p>";
    notice(e.message, true);
  }
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register(
        new URL("../sw.js", import.meta.url),
      );
    } catch (e) {
      notice("No se pudo habilitar el modo sin conexión: " + e.message, true);
    }
  }
}
window.addEventListener("focus", () => {
  if (section === "settings") void backupUI.refresh();
  if (!busy && !$("#editor").open && config && !["settings"].includes(section))
    run(async () => {
      config = (await getConfig()) || config;
      records = await getRecords();
      render();
    });
});
let lastDay = localDate();
setInterval(() => {
  const clock = $("#live-clock");
  if (clock) clock.textContent = clockText();
  const today = localDate();
  if (
    today !== lastDay &&
    !busy &&
    !$("#editor").open &&
    section !== "settings"
  ) {
    if (filterDate === lastDay) filterDate = today;
    if (selectedDate === lastDay) selectedDate = today;
    homeLink = null;
    month = today.slice(0, 7);
    lastDay = today;
    if (config) render();
  }
}, 1000);
init();
