export function formatDate(date: Date): string {
  const ano = String(date.getFullYear()).padStart(4, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function today(now = new Date()): string {
  return formatDate(now);
}
