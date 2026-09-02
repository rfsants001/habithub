import { formatDate } from "../db/date";

export type GraphEntry = {
  date: string;
};

export type Day = {
  date: string;
  total: number;
  level: Level;
};

export type Level = 0 | 1 | 2 | 3 | 4;

export type GraphMatrix = (Day | null)[][];

export function levelFor(total: number): Level {
  if (total <= 0) return 0;
  if (total === 1) return 1;
  if (total === 2) return 2;
  if (total <= 4) return 3;
  return 4;
}

export function buildGraph(entries: GraphEntry[], year: number): GraphMatrix {
  const counts = new Map<string, number>();
  const matrix: GraphMatrix = [];

  entries.forEach((entry) => {
    counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  });
  const jan1Offset = new Date(year, 0, 1).getDay();

  const daysInYear = Math.round(
    (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const weeks = Math.ceil((jan1Offset + daysInYear) / 7);

  for (let w = 0; w < weeks; w++) {
    const week: (Day | null)[] = [];

    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d - jan1Offset;

      if (offset < 0 || offset >= daysInYear) {
        week.push(null);
        continue;
      }

      const date = formatDate(new Date(year, 0, offset + 1));
      const total = counts.get(date) ?? 0;
      week.push({ date, total, level: levelFor(total) });
    }

    matrix.push(week);
  }

  return matrix;
}
