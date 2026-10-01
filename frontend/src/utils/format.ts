const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number, currency = "EUR"): string {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      // Divisa desconocida: mejor mostrar el número que romper la pantalla
      return formatCurrency(amount, "EUR");
    }
    currencyFormatters.set(currency, fmt);
  }
  return fmt.format(Number.isFinite(amount) ? amount : 0);
}

export function formatCompactNumber(amount: number): string {
  return new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(d);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "hace un momento";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHour < 24) return `hace ${diffHour} h`;
  if (diffDay === 1) return "ayer";
  if (diffDay < 7) return `hace ${diffDay} días`;
  return formatDate(d);
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("es-ES", { month: "short" }).format(d).replace(".", "");
}

// Valor para <input type="date">. Las fechas de los movimientos se guardan como
// medianoche UTC del día elegido, así que se leen en UTC; la fecha por defecto
// es "hoy" según el reloj local (si no, cerca de medianoche saldría el día anterior).
export function toInputDate(value?: string): string {
  if (value) return new Date(value).toISOString().slice(0, 10);
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Fecha de un movimiento (medianoche UTC del día elegido) -> "13 sept 2026"
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(date)
  );
}

// "hoy", "ayer", "hace 3 días"... comparando días del calendario
export function formatRelativeDay(date: string): string {
  const day = date.slice(0, 10);
  const diff = Math.round((Date.parse(toInputDate()) - Date.parse(day)) / 86_400_000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff > 1 && diff < 7) return `hace ${diff} días`;
  return formatDay(date);
}
