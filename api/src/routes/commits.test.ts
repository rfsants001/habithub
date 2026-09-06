import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { beforeEach, describe, expect, test } from "vitest";
import { db } from "../db/client";
import { formatDate, today } from "../db/date";
import { categories, entries, habits } from "../db/schema";
import { createServer } from "../server";

const app = createServer();

const inject = (opts: InjectOptions): Promise<LightMyRequestResponse> =>
  app.inject(opts);

const commit = (habitId: number, payload?: InjectOptions["payload"]) =>
  inject({ method: "POST", url: `/habits/${habitId}/commit`, payload });

/** Datas derivadas de "hoje" — o teste não pode quebrar na virada do ano. */
const hoje = today();
const anoAtual = Number(hoje.slice(0, 4));
const primeiroDiaDoAno = `${anoAtual}-01-01`;
const fimDoAnoPassado = `${anoAtual - 1}-12-31`;
const amanha = formatDate(
  new Date(new Date().setDate(new Date().getDate() + 1)),
);

type Dia = { date: string; total: number; level: number } | null;

/** Acha um dia na matriz do grafo devolvida pelo commit. */
const diaDoGrafo = (weeks: Dia[][], date: string) =>
  weeks.flat().find((day) => day?.date === date);

const given = async () => {
  const category = (
    await inject({
      method: "POST",
      url: "/categories",
      payload: { name: "Saúde", color: "#3fb950" },
    })
  ).json();

  const habit = (
    await inject({
      method: "POST",
      url: "/habits",
      payload: { name: "Academia", categoryId: category.id },
    })
  ).json();

  return { category, habit };
};

beforeEach(() => {
  db.delete(entries).run();
  db.delete(habits).run();
  db.delete(categories).run();
});

// [PH-1.2-004] Backdating — `date` opcional no commit (FN-011)
describe("POST /habits/:id/commit — sem date (comportamento da F1)", () => {
  test("commits today when no body is sent at all", async () => {
    const { habit } = await given();

    const res = await commit(habit.id);

    expect(res.statusCode).toBe(201);
    expect(diaDoGrafo(res.json().weeks, hoje)).toMatchObject({ total: 1 });
  });

  test("commits today when date is omitted but message is sent", async () => {
    const { habit } = await given();

    const res = await commit(habit.id, { message: "primeiro treino" });

    expect(res.statusCode).toBe(201);
    expect(diaDoGrafo(res.json().weeks, hoje)).toMatchObject({ total: 1 });
  });

  test("returns 404 for a habit that does not exist", async () => {
    const res = await commit(9999);

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Hábito não cadastrado");
  });
});

describe("POST /habits/:id/commit — com date (backdating)", () => {
  test("accepts a past date within the year and paints THAT day", async () => {
    const { habit } = await given();

    const res = await commit(habit.id, { date: primeiroDiaDoAno });

    expect(res.statusCode).toBe(201);
    expect(diaDoGrafo(res.json().weeks, primeiroDiaDoAno)).toMatchObject({
      total: 1,
    });
  });

  test("the backdated commit does NOT paint today", async () => {
    const { habit } = await given();

    const res = await commit(habit.id, { date: primeiroDiaDoAno });

    if (primeiroDiaDoAno !== hoje) {
      expect(diaDoGrafo(res.json().weeks, hoje)).toMatchObject({ total: 0 });
    }
  });

  test("accepts today explicitly", async () => {
    const { habit } = await given();

    const res = await commit(habit.id, { date: hoje });

    expect(res.statusCode).toBe(201);
    expect(diaDoGrafo(res.json().weeks, hoje)).toMatchObject({ total: 1 });
  });

  test("accepts date together with message", async () => {
    const { habit } = await given();

    const res = await commit(habit.id, {
      date: primeiroDiaDoAno,
      message: "retroativo",
    });

    expect(res.statusCode).toBe(201);
    expect(diaDoGrafo(res.json().weeks, primeiroDiaDoAno)).toMatchObject({
      total: 1,
    });
  });

  test("the date is persisted on the entry, not just echoed in the graph", async () => {
    const { habit } = await given();
    await commit(habit.id, { date: primeiroDiaDoAno });

    const salvas = db.select().from(entries).all();

    expect(salvas).toHaveLength(1);
    expect(salvas[0].date).toBe(primeiroDiaDoAno);
  });
});

describe("POST /habits/:id/commit — sem dedup (FN-011, comportamento da F1)", () => {
  test("two commits on the same backdated day ADD UP", async () => {
    const { habit } = await given();

    await commit(habit.id, { date: primeiroDiaDoAno });
    const res = await commit(habit.id, { date: primeiroDiaDoAno });

    expect(diaDoGrafo(res.json().weeks, primeiroDiaDoAno)).toMatchObject({
      total: 2,
    });
  });

  test("intensity climbs with repetition on the same day", async () => {
    const { habit } = await given();

    let ultimo;
    for (let i = 0; i < 5; i++) {
      ultimo = await commit(habit.id, { date: primeiroDiaDoAno });
    }

    expect(diaDoGrafo(ultimo!.json().weeks, primeiroDiaDoAno)).toMatchObject({
      total: 5,
      level: 4,
    });
  });
});

describe("POST /habits/:id/commit — datas rejeitadas (400)", () => {
  test("rejects a future date", async () => {
    const { habit } = await given();

    const res = await commit(habit.id, { date: amanha });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toEqual(expect.any(String));
  });

  test("rejects a date outside the graph year", async () => {
    const { habit } = await given();

    expect((await commit(habit.id, { date: fimDoAnoPassado })).statusCode).toBe(
      400,
    );
  });

  test.each([
    ["barras em vez de hífen", "05/09/2026"],
    ["sem zero à esquerda", "2026-9-5"],
    ["texto qualquer", "ontem"],
    ["vazio", ""],
    ["timestamp ISO completo", "2026-09-05T00:00:00.000Z"],
  ])("rejects %s with 400", async (_label, date) => {
    const { habit } = await given();

    expect((await commit(habit.id, { date })).statusCode).toBe(400);
  });

  test("rejects a date that matches the format but does not exist (2026-02-30)", async () => {
    const { habit } = await given();

    expect(
      (await commit(habit.id, { date: `${anoAtual}-02-30` })).statusCode,
    ).toBe(400);
  });

  test("a rejected commit writes nothing", async () => {
    const { habit } = await given();

    await commit(habit.id, { date: amanha });

    expect(db.select().from(entries).all()).toHaveLength(0);
  });

  test("the error message is in PT", async () => {
    const { habit } = await given();

    const res = await commit(habit.id, { date: amanha });

    expect(res.json().error).toMatch(/[áâãéêíóôõúç]|data|futur/i);
  });
});
