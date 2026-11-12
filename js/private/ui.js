import { getPrivateGuards, savePrivateGuards } from "../storage/db.js";
import {
  initialData,
  ensureCoverage,
  findPeriod,
  minute,
  civil,
  paraguayNow,
  periodLabel,
  displayTime,
  displayDate,
  duration,
  money,
  calculateShift,
  periodSummary,
  upsertShift,
  rerateShift,
  removeShift,
  editPeriod,
  changeSettings,
} from "./domain.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function createPrivateUI({ notice, onChanged }) {
  let data,
    selectedId = null,
    point = null,
    dialog = null,
    loadId = 0;
  function selected() {
    const at = point ?? minute(paraguayNow());
    ensureCoverage(data, at, at + 1);
    return (
      data.periods.find((p) => p.id === selectedId) || findPeriod(data, at)
    );
  }
  async function load() {
    const stored = await getPrivateGuards();
    data = stored || data || initialData();
    return data;
  }
  async function persist(next, revision) {
    data = await savePrivateGuards(next, revision);
    onChanged();
    await mount();
    await mountSettings();
  }
  function rootMarkup() {
    return '<div id="private-root"><h1>Guardias privadas</h1><p class="muted">Abriendo guardias…</p></div>';
  }
  async function mount() {
    const root = document.querySelector("#private-root");
    if (!root) return;
    const ticket = ++loadId;
    try {
      await load();
      if (ticket !== loadId || !root.isConnected) return;
      const p = selected(),
        s = periodSummary(data, p);
      selectedId = p.id;
      root.innerHTML = `<div class="page-heading"><h1>Guardias privadas</h1><span>Estimación bruta</span></div><div class="period-picker"><button id="private-prev" class="secondary" aria-label="Liquidación anterior">‹</button><label class="sr-only" for="private-period">Período privado</label><select id="private-period">${data.periods.map((item) => `<option value="${esc(item.id)}" ${item.id === p.id ? "selected" : ""}>${esc(periodLabel(item))}</option>`).join("")}</select><button id="private-next" class="secondary" aria-label="Liquidación siguiente">›</button></div>
 <section class="card private-total"><p class="eyebrow">TOTAL BRUTO ESTIMADO A FACTURAR</p><strong class="private-amount">${money(s.amount)}</strong><p>${s.count} guardia${s.count === 1 ? "" : "s"} · ${duration(s.minutes)}</p><p class="muted">Inicio: ${displayTime(p.start)}<br>Cierre exclusivo: ${displayTime(p.end)}<br>Factura: ${displayDate(p.billing.from)} – ${displayDate(p.billing.to)}</p><button id="private-add">Agregar guardia</button><button id="private-period-edit" class="text-button">Fechas del período / factura</button></section>
 <section aria-label="Guardias del período">${s.rows.length ? s.rows.map(({ shift, minutes, normalMinutes, weekendMinutes, amount, calculated }) => `<article class="card private-row" data-private-id="${esc(shift.id)}"><div class="card-top"><h2>${displayDate(shift.start)}</h2><strong>${money(amount)}</strong></div><p>${displayTime(shift.start)} → ${displayTime(shift.end)}</p><p>${duration(minutes)} en este período${calculated.allocations.length > 1 ? ` · Guardia total ${duration(calculated.minutes)} / ${money(calculated.amount)}` : ""}</p><p class="muted">Normal: ${duration(normalMinutes)} · Fin de semana: ${duration(weekendMinutes)}</p><div class="actions"><button class="text-button" data-private-edit="${esc(shift.id)}">Editar guardia</button><button class="text-button" data-private-delete="${esc(shift.id)}">Eliminar guardia</button></div></article>`).join("") : '<p class="empty">Sin guardias registradas en esta liquidación.</p>'}</section>`;
      root.querySelector("#private-add").onclick = () => openShift();
      root.querySelector("#private-period-edit").onclick = () =>
        openPeriod(p.id);
      root.querySelector("#private-period").onchange = (e) => {
        selectedId = e.target.value;
        point = minute(data.periods.find((p) => p.id === selectedId).start);
        mount();
      };
      for (const [id, delta] of [
        ["private-prev", -1],
        ["private-next", 1],
      ])
        root.querySelector("#" + id).onclick = () => {
          const p = selected();
          const at = delta < 0 ? minute(p.start) - 1 : minute(p.end);
          ensureCoverage(data, at, at + 1);
          selectedId = findPeriod(data, at).id;
          point = at;
          drawLocal();
        };
      root
        .querySelectorAll("[data-private-edit]")
        .forEach((b) => (b.onclick = () => openShift(b.dataset.privateEdit)));
      root.querySelectorAll("[data-private-delete]").forEach(
        (b) =>
          (b.onclick = async () => {
            const id = b.dataset.privateDelete,
              s = data.shifts.find((s) => s.id === id);
            if (
              !confirm(
                `¿Eliminar esta guardia de ${displayTime(s.start)} a ${displayTime(s.end)}? Se quitará de todas sus liquidaciones.`,
              )
            )
              return;
            try {
              await persist(removeShift(data, id), data.revision);
              notice("Guardia eliminada.");
            } catch (e) {
              notice(e.message, true);
            }
          }),
      );
    } catch (e) {
      root.innerHTML = '<h1>Guardias privadas</h1><p class="muted"></p>';
      root.querySelector("p").textContent = e.message;
    }
  }
  function drawLocal() {
    void mount();
  }
  function show(title, content) {
    if (dialog?.open) return false;
    dialog = document.createElement("dialog");
    dialog.className = "private-dialog";
    dialog.setAttribute("aria-label", title);
    dialog.innerHTML = `<form id="private-form"><div class="card-top"><h2>${title}</h2><button type="button" id="private-cancel" class="icon-button" aria-label="Cerrar formulario privado">×</button></div>${content}<p id="private-error" role="alert" hidden></p><button class="save-button" type="submit">Guardar</button></form>`;
    document.body.append(dialog);
    dialog.querySelector("#private-cancel").onclick = () => dialog.close();
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        dialog = null;
      },
      { once: true },
    );
    dialog.showModal();
    return true;
  }
  function fail(error) {
    const el = dialog?.querySelector("#private-error");
    if (el) {
      el.hidden = false;
      el.className = "error";
      el.textContent = error.message;
    } else notice(error.message, true);
  }
  function openShift(id) {
    const old = data.shifts.find((s) => s.id === id),
      base = structuredClone(data),
      revision = data.revision;
    let rates = { ...(old?.rates || data.config.rates) };
    if (
      !show(
        old ? "Editar guardia" : "Agregar guardia",
        `<label>Entrada privada<input name="private-start" type="datetime-local" step="60" value="${old?.start || paraguayNow()}" required></label><label>Salida privada<input name="private-end" type="datetime-local" step="60" value="${old?.end || ""}" required></label><div id="private-preview" class="muted">Completa ambas horas.</div><p class="muted" id="private-rate-label"></p>${old && JSON.stringify(old.rates) !== JSON.stringify(data.config.rates) ? '<button type="button" id="private-rerate" class="text-button">Recalcular con tarifas actuales</button>' : ""}`,
      )
    )
      return;
    const form = dialog.querySelector("form");
    function preview() {
      const label = dialog.querySelector("#private-rate-label");
      label.textContent = `Tarifas conservadas: ${money(rates.normal)}/h normal · ${money(rates.weekend)}/h fin de semana.`;
      try {
        const start = form.elements["private-start"].value,
          end = form.elements["private-end"].value,
          s = { id: old?.id || "preview", start, end, rates, history: [] },
          copy = structuredClone(base);
        ensureCoverage(copy, minute(start), minute(end));
        const v = calculateShift(s, copy.periods);
        dialog.querySelector("#private-preview").innerHTML =
          `<p>${duration(v.minutes)} · Normal: ${duration(v.normalMinutes)} · Fin de semana: ${duration(v.weekendMinutes)}</p><strong>${money(v.amount)} estimados</strong>`;
      } catch {
        dialog.querySelector("#private-preview").textContent =
          "La salida debe ser posterior a la entrada.";
      }
    }
    form.oninput = preview;
    dialog.querySelector("#private-rerate")?.addEventListener("click", () => {
      if (
        confirm(
          `¿Recalcular esta guardia con ${money(data.config.rates.normal)}/h normal y ${money(data.config.rates.weekend)}/h fin de semana? El importe estimado puede cambiar al guardar.`,
        )
      ) {
        rates = { ...data.config.rates };
        preview();
      }
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = form.querySelector("[type=submit]");
      button.disabled = true;
      try {
        const start = form.elements["private-start"].value,
          end = form.elements["private-end"].value;
        let next = upsertShift(base, { id, start, end }, rates);
        if (old && JSON.stringify(old.rates) !== JSON.stringify(rates))
          next = rerateShift(next, id, rates);
        point = minute(start);
        selectedId = findPeriod(next, point).id;
        await persist(next, revision);
        dialog.close();
        notice("Guardia guardada.");
      } catch (error) {
        fail(error);
      } finally {
        button.disabled = false;
      }
    };
    if (old) preview();
    else
      dialog.querySelector("#private-rate-label").textContent =
        `${money(rates.normal)}/h normal · ${money(rates.weekend)}/h fin de semana.`;
  }
  function openPeriod(id) {
    const p = data.periods.find((p) => p.id === id),
      base = structuredClone(data),
      revision = data.revision;
    ensureCoverage(base, minute(p.start) - 1, minute(p.end) + 1);
    if (
      !show(
        "Ajustar liquidación",
        `<p class="muted">Cambiar el inicio ajusta el cierre anterior. Cambiar el cierre ajusta el inicio siguiente. No quedan huecos ni superposiciones.</p><label>Inicio de liquidación<input name="period-start" type="datetime-local" value="${p.start}" required></label><label>Cierre exclusivo<input name="period-end" type="datetime-local" value="${p.end}" required></label><div class="filters"><label>Factura desde<input name="bill-from" type="date" value="${p.billing.from}" required></label><label>Factura hasta<input name="bill-to" type="date" value="${p.billing.to}" required></label></div>`,
      )
    )
      return;
    const form = dialog.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const result = editPeriod(base, id, {
          start: form.elements["period-start"].value,
          end: form.elements["period-end"].value,
          billFrom: form.elements["bill-from"].value,
          billTo: form.elements["bill-to"].value,
        });
        if (
          result.needsConfirmation &&
          !confirm(
            `Este ajuste afecta períodos pasados o ${result.affects} guardia(s). Se redistribuirán horas e importes entre liquidaciones, conservando horas y tarifas. ¿Confirmar?`,
          )
        )
          return;
        point = minute(result.data.periods.find((p) => p.id === id).start);
        selectedId = id;
        await persist(result.data, revision);
        dialog.close();
        notice("Liquidación ajustada.");
      } catch (error) {
        fail(error);
      }
    };
  }
  async function mountSettings() {
    const root = document.querySelector("#private-settings-root");
    if (!root) return;
    try {
      await load();
      const cfg = data.config;
      root.innerHTML = `<details class="card settings-group"><summary>Guardias privadas · tarifas y liquidación</summary><form id="private-settings-form"><div class="filters"><label>Normal (Gs./h)<input name="normal-rate" type="number" min="1" max="1000000000" step="1" value="${cfg.rates.normal}" required></label><label>Fin de semana (Gs./h)<input name="weekend-rate" type="number" min="1" max="1000000000" step="1" value="${cfg.rates.weekend}" required></label></div><p class="muted">Las tarifas se aplican solo a guardias nuevas. Las existentes conservan sus valores salvo recálculo explícito.</p><div class="filters"><label>Día de cierre habitual<input name="cycle-day" type="number" min="1" max="31" value="${cfg.pattern.day}" required></label><label>Hora de cierre<input name="cycle-time" type="time" value="${cfg.pattern.time}" required></label><label>Factura desde día<input name="bill-start" type="number" min="1" max="31" value="${cfg.pattern.billStart}" required></label><label>Factura hasta día<input name="bill-end" type="number" min="1" max="31" value="${cfg.pattern.billEnd}" required></label></div><p class="muted">El período actual conserva sus límites y factura. El patrón nuevo se aplica desde la liquidación siguiente, sin cambiar horas ni tarifas históricas. Los días que no existan en un mes se ajustan a su último día.</p><button type="submit">Guardar ajustes privados</button></form></details>`;
      const form = root.querySelector("form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const revision = data.revision,
          base = structuredClone(data),
          f = new FormData(form);
        try {
          const result = changeSettings(base, {
            rates: {
              normal: Number(f.get("normal-rate")),
              weekend: Number(f.get("weekend-rate")),
            },
            pattern: {
              day: Number(f.get("cycle-day")),
              time: f.get("cycle-time"),
              billStart: Number(f.get("bill-start")),
              billEnd: Number(f.get("bill-end")),
            },
          });
          if (
            result.needsConfirmation &&
            !confirm(
              `${result.boundariesChanged ? `El nuevo patrón puede redistribuir ${result.affects} guardia(s) futuras.` : "Cambiarán las fechas informativas de facturación."} Puede reemplazar ajustes futuros individuales. No cambia el período actual ni tarifas guardadas. ¿Confirmar?`,
            )
          )
            return;
          await persist(result.data, revision);
          notice("Configuración privada guardada.");
        } catch (error) {
          notice(error.message, true);
        }
      };
    } catch (error) {
      root.textContent = error.message;
    }
  }
  return { rootMarkup, mount, mountSettings, isEditing: () => !!dialog?.open };
}
