import { describe, expect, test } from "vitest";
import { buildGraph, levelFor } from "./graph";

const entry = (date: string) => ({ date });

describe("levelFor", () => {
  test("calibrated bands 0/1/2/3-4/5+", () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(1)).toBe(1);
    expect(levelFor(2)).toBe(2);
    expect(levelFor(3)).toBe(3);
    expect(levelFor(4)).toBe(3);
    expect(levelFor(5)).toBe(4);
    expect(levelFor(50)).toBe(4);
  });
});

describe("buildGraph", () => {
  const findDay = (matrix: ReturnType<typeof buildGraph>, date: string) =>
    matrix.flat().find((day) => day?.date === date);

  test("the grid is rectangular: 53 (or 54) columns of 7 days", () => {
    const matrix = buildGraph([], 2026);
    expect(matrix).toHaveLength(53);
    expect(matrix.every((week) => week.length === 7)).toBe(true);
  });

  test("every day of the year shows up EXACTLY once", () => {
    const dates = buildGraph([], 2026)
      .flat()
      .filter((day) => day !== null)
      .map((day) => day!.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates[0]).toBe("2026-01-01");
    expect(dates.at(-1)).toBe("2026-12-31");
  });

  test("a day with no entry has total 0 and level 0 (failure without punishment)", () => {
    const matrix = buildGraph([], 2026);
    expect(findDay(matrix, "2026-06-15")).toMatchObject({ total: 0, level: 0 });
  });

  test("several commits on the same day ADD UP (FN-007)", () => {
    const matrix = buildGraph(
      [entry("2026-06-15"), entry("2026-06-15"), entry("2026-06-15")],
      2026,
    );
    expect(findDay(matrix, "2026-06-15")).toMatchObject({ total: 3, level: 3 });
  });

  test("5+ commits saturate at level 4", () => {
    const matrix = buildGraph(
      Array.from({ length: 9 }, () => entry("2026-03-01")),
      2026,
    );
    expect(findDay(matrix, "2026-03-01")).toMatchObject({ total: 9, level: 4 });
  });

  test("the boundary days of the year exist in the matrix", () => {
    const matrix = buildGraph([entry("2026-01-01"), entry("2026-12-31")], 2026);
    expect(findDay(matrix, "2026-01-01")).toMatchObject({ total: 1 });
    expect(findDay(matrix, "2026-12-31")).toMatchObject({ total: 1 });
  });

  test("an entry from another year is ignored", () => {
    const matrix = buildGraph([entry("2025-12-31")], 2026);
    expect(findDay(matrix, "2025-12-31")).toBeUndefined();
  });

  test("column = week: each column advances 7 days", () => {
    const matrix = buildGraph([], 2026);
    const firstDay = matrix.flat().find((day) => day !== null)!;
    expect(matrix[0].filter(Boolean).length).toBeLessThanOrEqual(7);
    expect(firstDay.date.startsWith("2026-01")).toBe(true);
  });

  test("a common year has 365 filled days", () => {
    expect(buildGraph([], 2026).flat().filter(Boolean)).toHaveLength(365);
  });

  test("a leap year starting on Saturday (2028) needs 54 columns", () => {
    const matrix = buildGraph([], 2028);
    expect(matrix).toHaveLength(54);
    expect(matrix.flat().filter(Boolean)).toHaveLength(366);
    expect(
      matrix.flat().find((day) => day?.date === "2028-12-31"),
    ).toBeDefined();
  });

  test("row 0 is always Sunday", () => {
    for (const year of [2026, 2027, 2028]) {
      for (const week of buildGraph([], year)) {
        for (const [row, day] of week.entries()) {
          if (!day) continue;
          expect(new Date(`${day.date}T12:00:00`).getDay()).toBe(row);
        }
      }
    }
  });
});
