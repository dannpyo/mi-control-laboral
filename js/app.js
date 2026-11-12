import {
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
const badge = (r) => {
  const a = assessment(r, config);
  if (a.future) return "Programada";
  if (r.type !== "normal") return TYPES[r.type];
  return (
    [
      a.late ? "Llegada tardía" : "",
      a.early ? "Salida anticipada" : "",
      a.omissions ? `${a.omissions} omisión(es)` : "",
      a.pending ? "Pendiente de revisión" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Sin incidencias detectadas"
  );
};
function recordCard(date, id) {
  const r = recordFor(date, id),
    l = config.links.find((l) => l.id === id),
    s = r?.schedule || l;
  return `<article class="card"><div class="card-top"><h3>${esc(l.name)}</h3><span class="tag">${esc(s.start)}–${esc(s.end)}</span></div><p>${dateLabel(date)} · ${esc(r ? badge(r) : config.holidays.includes(date) ? "Feriado libre" : "Sin registro personal · pendiente")}</p><p class="times">Entrada <strong>${esc(r?.entry || "—")}</strong> <span>Salida <strong>${esc(r?.exit || "—")}</strong></span></p><button data-edit="${esc(id)}" data-date="${date}">${r ? "Ver / editar jornada" : "Registrar jornada"}</button></article>`;
}
function nextShift() {
  const today = localDate();
  for (let i = 0; i < 370; i++) {
    const d = parseDate(today);
    d.setDate(d.getDate() + i);
    const date = localDate(d);
    if (date < config.startDate) continue;
    for (const l of config.links) {
      const r = recordFor(date, l.id);
      const type =
        r?.type || (config.holidays.includes(date) ? "holiday-free" : "normal");
      if (
        [
          "holiday-free",
          "vacation",
          "medical",
          "permission",
          "justified",
          "unjustified",
          "swap",
          "pending",
        ].includes(type)
      )
        continue;
      const s = r?.schedule || l;
      if (
        (l.day === d.getDay() || r) &&
        (i > 0 ||
          new Date().getHours() * 60 + new Date().getMinutes() <
            Number(s.end.slice(0, 2)) * 60 + Number(s.end.slice(3)))
      )
        return `${l.name} · ${dateLabel(date)} · ${s.start}–${s.end}`;
    }
  }
  return "Sin próximas jornadas en el rango de un año";
}
function home() {
  const today = localDate(),
    scheduled = config.links.filter(
      (l) =>
        (today >= config.startDate && l.day === new Date().getDay()) ||
        recordFor(today, l.id),
    );
  return `<h1>Tu jornada, a mano.</h1><p class="intro">${new Date().toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" })}</p><div class="callout"><strong>Registro personal</strong><p>Marcar aquí no registra asistencia en el reloj biométrico. Los estados oficiales se confirman por separado al editar cada jornada.</p></div><section><h2>Hoy</h2>${scheduled.length ? scheduled.map((l) => recordCard(today, l.id)).join("") : '<p class="empty">No hay una jornada programada para hoy.</p>'}</section><section class="card"><h2>Marcar ahora</h2><p>Se usa la fecha y hora local del celular. Revisa que sean correctas.</p><label>Vínculo<select id="quick-link">${config.links.map((l) => `<option value="${l.id}" ${l.day === new Date().getDay() ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label><div class="actions"><button data-mark="entry">Marcar entrada</button><button data-mark="exit" class="secondary">Marcar salida</button></div></section><section class="card"><h2>Próxima jornada</h2><p>${esc(nextShift())}</p></section><button id="manual">Ingreso manual / otra fecha</button>`;
}
function calendar() {
  const first = parseDate(`${month}-01`),
    count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(),
    today = localDate();
  let cells = Array(first.getDay()).fill("<span></span>");
  for (let n = 1; n <= count; n++) {
    const d = `${month}-${String(n).padStart(2, "0")}`,
      rs = records.filter((r) => r.date === d),
      isScheduled =
        d >= config.startDate &&
        config.links.some((l) => l.day === parseDate(d).getDay()),
      holiday = config.holidays.includes(d);
    const indicators = rs.map((r) => {
      const a = assessment(r, config);
      return a.future
        ? "future"
        : a.lateCount || a.earlyCount || a.omissions || r.type === "unjustified"
          ? "incident"
          : a.pending
            ? "review"
            : "recorded";
    });
    let kind =
      d > today
        ? isScheduled
          ? "scheduled"
          : ""
        : indicators.includes("incident")
          ? "incident"
          : indicators.includes("review")
            ? "review"
            : rs.length
              ? "recorded"
              : holiday
                ? "holiday"
                : isScheduled
                  ? "scheduled"
                  : "";
    cells.push(
      `<button class="day ${kind} ${d === selectedDate ? "selected" : ""}" data-day="${d}" aria-label="${dateLabel(d)}${d === today ? ", hoy" : ""}: ${esc(rs.map((r) => badge(r)).join(", ") || (holiday ? "Feriado libre" : isScheduled ? "Programada, sin registro" : "Sin jornada"))}" ${d === selectedDate ? 'aria-pressed="true"' : ""}>${n}${d === today ? '<span class="today">•</span>' : ""}</button>`,
    );
  }
  return `<h1>Calendario</h1><label>Mes<input type="month" id="month" value="${month}" required></label><p class="legend">● Verde: registro / feriado · Ámbar: pendiente · Rojo: incidencia · Borde: programada. El futuro no genera faltas.</p><div class="calendar">${days.map((d) => `<span class="weekday">${d.slice(0, 2)}</span>`).join("")}${cells.join("")}</div><h2>${dateLabel(selectedDate)}</h2>${config.links.map((l) => recordCard(selectedDate, l.id)).join("")}`;
}
function filters() {
  return `<div class="filters"><label>Fecha del período<input type="date" id="filter-date" value="${filterDate}" required></label><label>Vínculo<select id="filter-link"><option value="all">Todos</option>${config.links.map((l) => `<option value="${l.id}" ${l.id === filterLink ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label></div>`;
}
function summary() {
  const p = period(filterDate);
  return `<h1>Resumen</h1>${filters()}<p class="period">${dateLabel(p.start)} al ${dateLabel(p.end)}, inclusive</p><p class="muted">Los períodos se calculan por fecha: el día 16 empieza uno nuevo sin borrar registros. Solo se cuentan incidencias injustificadas; las pendientes se muestran aparte. Las jornadas sin registro desde el inicio del seguimiento requieren revisión y no se consideran ausencias.</p>${config.links
    .filter((l) => filterLink === "all" || filterLink === l.id)
    .map((l) => {
      const s = stats(records, config, l.id, p);
      return `<article class="card"><h2>${esc(l.name)}</h2><div class="metrics"><div><strong>${s.days}</strong>Jornadas registradas</div><div><strong>${s.hours.toFixed(2)}</strong>Horas personales</div><div><strong>${s.pending}</strong>Pendientes</div><div><strong>${s.absences}</strong>Ausencias injustificadas</div><div><strong>${s.unrecorded}</strong>Jornadas sin registro (revisar)</div></div>${[
        ["Tardanzas", s.late, "late"],
        ["Salidas anticipadas", s.early, "early"],
        ["Omisiones oficiales", s.omissions, "omission"],
      ]
        .map(
          ([name, n, t]) =>
            `<div class="rule-row"><span>${name}: <strong>${n}</strong></span><span>Estimación: ${typeof fine(n, t) === "number" ? `${fine(n, t)} día(s) de salario` : fine(n, t)}</span></div>${n >= 2 ? `<p class="alert">Alerta preventiva: ${name.toLowerCase()} acumuladas en este período.</p>` : ""}`,
        )
        .join(
          "",
        )}<p class="muted">Omisión permitida utilizada: ${Math.min(1, s.omissions)} / 1.</p></article>`;
    })
    .join(
      "",
    )}<div class="callout">Estimaciones informativas basadas en el régimen indicado por el usuario. No son decisiones disciplinarias oficiales. Las tardanzas y salidas anticipadas se calculan por separado, sin compensación por horas posteriores.</div>`;
}
function history() {
  const p = period(filterDate);
  const list = records
    .filter(
      (r) =>
        r.date >= p.start &&
        r.date <= p.end &&
        (filterLink === "all" || r.link === filterLink),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.link.localeCompare(b.link),
    );
  return `<h1>Historial</h1>${filters()}<p>${dateLabel(p.start)} al ${dateLabel(p.end)}</p><p class="muted">Más recientes primero. Cada jornada conserva sus horarios y tolerancias originales.</p>${list.map((r) => recordCard(r.date, r.link)).join("") || '<p class="empty">No hay registros en este período.</p>'}<button id="manual">Ingreso manual</button>`;
}
function settings() {
  return `<h1>Configuración</h1><form id="settings-form"><section class="card"><h2>Horarios</h2><p class="muted">Cambios aplicables a jornadas nuevas. Los registros existentes conservan su horario y tolerancia.</p><label>Inicio del seguimiento<input name="startDate" type="date" value="${config.startDate}" required></label>${config.links.map((l) => `<fieldset><legend>${esc(l.name)}</legend><label>Nombre<input name="name${l.id}" maxlength="80" value="${esc(l.name)}" required></label><label>Día<select name="day${l.id}">${days.map((d, i) => `<option value="${i}" ${l.day === i ? "selected" : ""}>${d}</option>`).join("")}</select></label><div class="filters"><label>Entrada<input type="time" name="start${l.id}" value="${l.start}" required></label><label>Salida<input type="time" name="end${l.id}" value="${l.end}" required></label></div></fieldset>`).join("")}</section><section class="card"><h2>Tolerancias inclusivas</h2><label>Normal (minutos)<input type="number" name="normalTolerance" min="0" max="180" value="${config.normalTolerance}" required></label><label>Lluvia: total de minutos, no adicional<input type="number" name="rainTolerance" min="0" max="180" value="${config.rainTolerance}" required></label></section><section class="card"><h2>Feriados</h2><p>No se descarga un calendario externo. Introduce las fechas oficiales que correspondan. Son libres por defecto para los tres vínculos. En el calendario puedes cambiar una fecha y vínculo a «Feriado trabajado» u otra situación. Los registros ya guardados son excepciones y se conservan.</p><label>Fechas, una por línea (AAAA-MM-DD)<textarea name="holidays" rows="5" placeholder="2026-12-25">${esc(config.holidays.join("\n"))}</textarea></label></section><button type="submit">Guardar configuración</button></form><section class="card"><h2>Reglas de incidencia</h2><p>Una omisión oficial de entrada o salida permitida por vínculo y período. Solo se cuentan omisiones confirmadas en una jornada cerrada, una vez transcurrido su horario de salida.</p><p>Omisiones: 0–1 → 0 días; 2 → 1; 3 → 2; 4 → 3; 5 → 4; más de 5 → revisión normativa.</p><p>Tardanzas y salidas anticipadas, cada tipo por separado: 0–2 → 0 días; 3 → 1; 4 → 2; 5 → 3; 6 → 4; 7 o más → 5 días.</p><p>Solo cuentan incidencias injustificadas. Una jornada sin marcaciones no se convierte en ausencia injustificada. Las jornadas futuras no suman incidencias. La ausencia injustificada se identifica, sin inventar una escala de sanción adicional.</p></section><section class="card"><h2>Respaldo local</h2><p>Exporta regularmente: el navegador puede borrar sus datos. JSON conserva configuración e historial de cambios. CSV sirve para consulta y no para restaurar.</p><div class="actions"><button id="json-export">Exportar JSON</button><button id="csv-export" class="secondary">Exportar CSV</button></div><label>Importar respaldo JSON (hasta 20 MB)<input id="json-import" type="file" accept="application/json,.json"></label><label class="check"><input type="checkbox" id="restore-config">Restaurar también la configuración del respaldo</label><p class="muted">La importación agrega solo jornadas inexistentes; las coincidentes se omiten sin sobrescribirlas. La configuración actual se conserva salvo que elijas restaurarla. No se envían datos a servicios externos.</p></section>`;
}
function render() {
  $("#view").innerHTML = { home, calendar, summary, history, settings }[
    section
  ]();
  document.querySelectorAll("nav button").forEach((b) => {
    b.disabled = false;
    b.classList.toggle("active", b.dataset.section === section);
    b.setAttribute(
      "aria-current",
      b.dataset.section === section ? "page" : "false",
    );
  });
  bind();
}
function bind() {
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) => (b.onclick = () => openEditor(b.dataset.date, b.dataset.edit)),
    );
  $("#manual")?.addEventListener("click", () =>
    openEditor(selectedDate, config.links[0].id),
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
  render();
  notice("Marcación personal guardada. No modifica el reloj biométrico.");
}
const stateOptions = (value, official = false) =>
  (official
    ? [
        ["pending", "Pendiente de confirmar"],
        ["marked", "Marcación oficial realizada"],
        ["missing", "Omisión oficial confirmada"],
      ]
    : [
        ["pending", "Pendiente de revisión"],
        ["justified", "Justificada"],
        ["unjustified", "Injustificada"],
      ]
  )
    .map(
      ([v, l]) =>
        `<option value="${v}" ${v === value ? "selected" : ""}>${l}</option>`,
    )
    .join("");
function openEditor(date, id) {
  const existing = recordFor(date, id);
  editing = existing ? structuredClone(existing) : blank(date, id, config);
  const r = editing;
  $("#editor-content").innerHTML =
    `<h2 id="editor-title">Jornada · ${esc(linkName(id))}</h2><p class="muted">Registro personal independiente del reloj biométrico.</p><div class="filters"><label>Fecha<input type="date" id="edit-date" value="${date}" required></label><label>Vínculo<select id="edit-link">${config.links.map((l) => `<option value="${l.id}" ${l.id === id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label></div><p class="muted">Cambiar fecha o vínculo abre esa jornada; no traslada ni elimina la actual. Guarda antes los cambios que quieras conservar.</p><label>Situación<select name="type">${Object.entries(
      TYPES,
    )
      .map(
        ([v, l]) =>
          `<option value="${v}" ${v === r.type ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><div class="filters"><label>Entrada personal<input type="time" name="entry" value="${r.entry}"></label><label>Salida personal<input type="time" name="exit" value="${r.exit}"></label></div><label class="check"><input type="checkbox" name="rain" ${r.rain ? "checked" : ""}>Condición de lluvia (tolerancia total: ${r.schedule.rainTolerance} min)</label><fieldset><legend>Horario de esta jornada</legend><p>Modificar aquí permite documentar una guardia excepcional sin cambiar otros días.</p><div class="filters"><label>Inicio previsto<input type="time" name="scheduleStart" value="${r.schedule.start}" required></label><label>Fin previsto<input type="time" name="scheduleEnd" value="${r.schedule.end}" required></label></div></fieldset><label>Justificación de tardanza<select name="lateState">${stateOptions(r.lateState)}</select></label><label>Justificación de salida anticipada<select name="earlyState">${stateOptions(r.earlyState)}</select></label><fieldset><legend>Reloj biométrico oficial</legend><p>Confirma sus estados manualmente. Una hora personal vacía no prueba una omisión oficial.</p><label>Entrada oficial<select name="officialEntry">${stateOptions(r.officialEntry, true)}</select></label><label>Salida oficial<select name="officialExit">${stateOptions(r.officialExit, true)}</select></label><label class="check"><input name="closed" type="checkbox" ${r.closed ? "checked" : ""}>Jornada revisada / cerrada para contar omisiones</label></fieldset><label>Observaciones<textarea name="notes" maxlength="10000" rows="4">${esc(r.notes)}</textarea></label><p class="muted">Horario guardado: ${r.schedule.start}–${r.schedule.end}. Tolerancia normal ${r.schedule.normalTolerance} min. Las incidencias nuevas quedan pendientes hasta indicar su justificación.</p><details><summary>Historial de modificaciones (${r.history.length})</summary>${
      r.history.length
        ? r.history
            .slice()
            .reverse()
            .map(
              (h) =>
                `<article class="audit"><strong>${esc(new Date(h.at).toLocaleString("es-PY"))} · ${esc(h.action)}</strong><pre>${esc(JSON.stringify({ antes: h.before, despues: h.after }, null, 2))}</pre></article>`,
            )
            .join("")
        : "<p>Sin modificaciones guardadas.</p>"
    }</details><p id="editor-status" role="alert" hidden></p><div class="actions"><button type="submit">Guardar jornada</button><button type="button" id="cancel-edit" class="secondary">Cancelar</button></div>`;
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
        lateState: f.get("lateState"),
        earlyState: f.get("earlyState"),
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
    selectedDate = r.date;
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
  const fresh = await getRecords(),
    current = (await getConfig()) || config;
  if (format === "json")
    download(
      JSON.stringify(
        {
          format: "mi-control-laboral",
          version: 1,
          exportedAt: new Date().toISOString(),
          config: current,
          records: fresh,
        },
        null,
        2,
      ),
      "application/json",
      `mi-control-laboral-${localDate()}.json`,
    );
  else {
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
document.querySelectorAll("nav button").forEach(
  (b) =>
    (b.onclick = () => {
      section = b.dataset.section;
      render();
      window.scrollTo(0, 0);
      $("#view").focus();
    }),
);
async function init() {
  try {
    config = (await getConfig()) || defaults();
    validateConfig(config);
    if (!(await getConfig())) await saveConfig(config);
    records = await getRecords();
    render();
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
  if (!busy && !$("#editor").open && config && !["settings"].includes(section))
    run(async () => {
      config = (await getConfig()) || config;
      records = await getRecords();
      render();
    });
});
let lastDay = localDate();
setInterval(() => {
  const today = localDate();
  if (
    today !== lastDay &&
    !busy &&
    !$("#editor").open &&
    section !== "settings"
  ) {
    if (filterDate === lastDay) filterDate = today;
    if (selectedDate === lastDay) selectedDate = today;
    month = today.slice(0, 7);
    lastDay = today;
    if (config) render();
  }
}, 30000);
init();
