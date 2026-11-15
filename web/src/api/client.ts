export type Category = { id: number; name: string; color: string };
export type HabitInput = { name: string; categoryId: number; daysPerWeek: number };
export type Habit = HabitInput & {
  id: number; active: boolean; categoryName: string; color: string;
  weekDates: string[]; weekCount: number; totalCommits: number;
  lastDate: string | null; doneToday: boolean;
};
export type Overview = { today: string; week: { start: string; end: string }; categories: Category[]; habits: Habit[] };
export type Entry = { id: number; date: string; message: string | null };
export type Day = { date: string; level: number; total: number };
export type GraphResponse = { year: number; weeks: (Day | null)[][]; category: Category };
export type CommitResponse = { created: boolean; entryId: number; date: string };

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method, signal,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(detail?.error ?? 'O HabitHub não conseguiu completar a ação.', response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const api = {
  overview: (signal?: AbortSignal) => request<Overview>('/overview', 'GET', undefined, signal),
  createCategory: (input: Omit<Category, 'id'>) => request<Category>('/categories', 'POST', input),
  updateCategory: (id: number, input: Omit<Category, 'id'>) => request<Category>(`/categories/${id}`, 'PATCH', input),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, 'DELETE'),
  createHabit: (input: HabitInput) => request<Habit>(`/habits`, 'POST', input),
  updateHabit: (id: number, input: Partial<HabitInput & { active: boolean }>) => request<Habit>(`/habits/${id}`, 'PATCH', input),
  record: (id: number, input: { date?: string; message?: string }) => request<CommitResponse>(`/habits/${id}/commit`, 'POST', input),
  removeEntry: (habitId: number, id: number) => request<void>(`/habits/${habitId}/entries/${id}`, 'DELETE'),
  month: (id: number, month: string, signal: AbortSignal) => request<{ month: string; entries: Entry[] }>(`/habits/${id}/history?month=${month}`, 'GET', undefined, signal),
  graph: (id: number, year: number, signal: AbortSignal) => request<GraphResponse>(`/categories/${id}/graph?year=${year}`, 'GET', undefined, signal),
  backup: () => request<unknown>('/backup'),
};

export function explain(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível conectar. Confira se o HabitHub está rodando e tente de novo.';
}
