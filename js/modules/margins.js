// Solo presentación preventiva. No clasifica registros ni modifica sus contadores.
export function incidenceMargin(count, type) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    !["late", "early", "omission"].includes(type)
  )
    throw Error("Incidencia o contador inválido");
  const threshold = type === "omission" ? 2 : 3;
  const remaining = Math.max(0, threshold - 1 - count);
  const reached = count >= threshold;
  return {
    count,
    threshold,
    remaining,
    reached,
    level: remaining === 1 ? "amber" : remaining > 1 ? "green" : "red",
    message: reached
      ? "Umbral de posible descuento alcanzado"
      : remaining === 0
        ? "La próxima incidencia podría generar descuento"
        : "",
  };
}
