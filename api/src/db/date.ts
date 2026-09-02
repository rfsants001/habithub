export function today(now = new Date()): string {
  return now.toLocaleDateString("sv-SE");
}
