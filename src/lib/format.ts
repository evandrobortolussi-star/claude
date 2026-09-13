export function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseBRLToCents(value: string): number {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const amount = parseFloat(normalized);
  if (Number.isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

/** Parses a `date`-only string ("YYYY-MM-DD") as a local date, never UTC —
 * `new Date("2026-03-15")` is midnight UTC and can render as the previous
 * day in negative-offset timezones (e.g. Brazil). */
function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

export function toDateInputValue(date: Date | string): string {
  if (typeof date === 'string') return date.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Mirrors the `card_invoice_month` SQL function: which invoice (its
 * first-of-month) a card purchase on this date belongs to. */
export function cardInvoiceMonth(occurredOnISO: string, closingDay: number): string {
  const [year, month, day] = occurredOnISO.split('-').map(Number);
  if (day > closingDay) {
    const next = new Date(year, month, 1); // month is already +1 here (0-indexed next month)
    return toDateInputValue(next);
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Adds N months to a "YYYY-MM-DD" date, clamping the day to the target
 * month's last day (e.g. Jan 31 + 1 month -> Feb 28/29). */
export function addMonthsClamped(dateISO: string, months: number): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfTargetMonth));
  return toDateInputValue(target);
}
