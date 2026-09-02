export function formatDate(date: Date): string {
  return date.toLocaleDateString("sv-SE");
}

export function today(now = new Date()): string {
  return formatDate(now);
}
