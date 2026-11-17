/** Builds the month label of period `index` counted from the start date. */
export function periodLabel(index: number, startDate: string): string {
  const start = new Date(startDate);
  start.setMonth(start.getMonth() + index);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
