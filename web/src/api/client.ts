import { log } from "../lib/log";

export type Category = {
  id: number;
  name: string;
  color: string;
  createdAt: string;
};

export type Habit = {
  id: number;
  name: string;
  categoryId: number;
  active: boolean;
  categoryName: string;
  color: string;
  totalCommits: number;
  lastDate: string | null;
  doneToday: boolean;
};

export type Level = 0 | 1 | 2 | 3 | 4;
export type Day = { date: string; total: number; level: Level };
export type GraphResponse = {
  category: { id: number; name: string; color: string };
  year: number;
  weeks: (Day | null)[][];
};

export type CommitResponse = {
  categoryId: number;
  year: number;
  weeks: (Day | null)[][];
};

export const fetchGraph = (categoryId: number) =>
  request<GraphResponse>(`/categories/${categoryId}/graph`);

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${url}`, {
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    log.error(
      `${init?.method ?? "GET"} ${url} -> ${response.status}`,
      body.error,
    );
    throw new ApiError(response.status, body.error ?? "Algo deu errado");
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  listCategories: () => request<Category[]>("/categories"),
  createCategory: (input: { name: string; color: string }) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCategory: (id: number, input: { name?: string; color?: string }) =>
    request<Category>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteCategory: (id: number) =>
    request<void>(`/categories/${id}`, {
      method: "DELETE",
    }),
  listHabits: () => request<Habit[]>("/habits"),
  createHabit: (input: { name: string; categoryId: number }) =>
    request<Habit>("/habits", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateHabit: (
    id: number,
    input: { name?: string; categoryId?: number; active?: boolean },
  ) =>
    request<Habit>(`/habits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteHabit: (id: number) =>
    request<void>(`/habits/${id}`, {
      method: "DELETE",
    }),
  commit: (habitId: number, input: { date?: string; message?: string } = {}) =>
    request<CommitResponse>(`/habits/${habitId}/commit`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
