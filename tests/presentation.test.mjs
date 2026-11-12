import test from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../js/modules/domain.js";
import {
  clockText,
  defaultLink,
  readTheme,
  THEME_KEY,
  EXPECTED_ZONE,
} from "../js/modules/presentation.js";
test("reloj local con segundos y cero inicial, sin formato AM/PM", () => {
  assert.equal(clockText(new Date("2026-11-12T07:30:05")), "07:30:05");
  assert.equal(clockText(new Date("2026-11-12T00:00:00")), "00:00:00");
  assert.equal(EXPECTED_ZONE, "America/Asuncion");
});
test("vínculo automático por día y ningún vínculo en día libre", () => {
  const links = defaults().links;
  for (const [date, id] of [
    ["2026-11-11", "1"],
    ["2026-11-12", "2"],
    ["2026-11-15", "3"],
    ["2026-11-16", ""],
  ])
    assert.equal(defaultLink(links, new Date(date + "T07:00:00")), id);
});
test("tema oscuro inicial, preferencia válida y almacenamiento no disponible", () => {
  assert.equal(
    readTheme({
      getItem: (key) => {
        assert.equal(key, THEME_KEY);
        return "light";
      },
    }),
    "light",
  );
  for (const value of [null, "dark", "otro"])
    assert.equal(readTheme({ getItem: () => value }), "dark");
  assert.equal(
    readTheme({
      getItem: () => {
        throw Error("bloqueado");
      },
    }),
    "dark",
  );
});
