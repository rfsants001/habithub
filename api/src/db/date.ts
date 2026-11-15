export function formatDate(date: Date): string {
  const ano = String(date.getFullYear()).padStart(4, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function today(now = new Date()): string {
  return formatDate(now);
}

export function weekBounds(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
}
