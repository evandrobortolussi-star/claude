/** Shared month-query-param parsing — every page with a month selector
 * (transactions, dashboard, reports) reads `?month=YYYY-MM` the same way. */
export function parseMonthParam(month?: string) {
  const now = new Date();
  const [year, m] = (month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number);
  return { year, month: m, start: new Date(year, m - 1, 1), end: new Date(year, m, 1) };
}

export function shiftMonthParam(year: number, month: number, delta: number): string {
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
