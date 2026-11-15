const pt = 'pt-BR';
export const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const fullWeekdays = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

export function dayObject(date: string) {
  return new Date(`${date}T12:00:00`);
}

export function formatDate(date: Date): string {
  return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function addDays(date: string, amount: number) {
  const next = dayObject(date);
  next.setDate(next.getDate() + amount);
  return formatDate(next);
}

export function moveMonth(month: string, amount: number) {
  const next = dayObject(`${month}-01`);
  next.setMonth(next.getMonth() + amount);
  return formatDate(next).slice(0, 7);
}

export const humanDate = (date: string) => new Intl.DateTimeFormat(pt, { dateStyle: 'short' }).format(dayObject(date));
export const longDate = (date: string) => new Intl.DateTimeFormat(pt, { weekday: 'long', day: 'numeric', month: 'long' }).format(dayObject(date));
export const monthLabel = (month: string) => new Intl.DateTimeFormat(pt, { month: 'long', year: 'numeric' }).format(dayObject(`${month}-01`));
