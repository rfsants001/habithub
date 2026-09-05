import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { beforeEach, describe, expect, test } from "vitest";
import { db } from "../db/client";
import { categories, entries, habits } from "../db/schema";
import { createServer } from "../server";

const app = createServer();

const inject = (opts: InjectOptions): Promise<LightMyRequestResponse> =>
  app.inject(opts);

const patch = (id: number, payload: InjectOptions["payload"]) =>
  inject({ method: "PATCH", url: `/habits/${id}`, payload });

const listHabits = async (includeArchived = false) =>
  (
    await inject({
      url: `/habits${includeArchived ? "?includeArchived=true" : ""}`,
    })
  ).json();

/** Uma categoria com um hábito dentro, que é o cenário de toda edição. */
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

// Guarda da PH-1.2-001: a listagem devolve `color` (hex), não `colorHue`.
describe("GET /habits", () => {
  test("brings the category color as `color` in hex", async () => {
    await given();

    const [listed] = await listHabits();

    expect(listed.color).toBe("#3fb950");
    expect(listed).not.toHaveProperty("colorHue");
  });

  test("brings the category name alongside the habit", async () => {
    await given();

    expect((await listHabits())[0]).toMatchObject({
      name: "Academia",
      categoryName: "Saúde",
      active: true,
    });
  });
});

// [PH-1.2-003] PATCH /habits/:id — nome, categoria e arquivamento (FN-009)
describe("PATCH /habits/:id", () => {
  test("renames the habit and returns 200", async () => {
    const { habit } = await given();

    const res = await patch(habit.id, { name: "Musculação" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: habit.id, name: "Musculação" });
  });

  test("moves the habit to another category", async () => {
    const { habit } = await given();
    const destino = (
      await inject({
        method: "POST",
        url: "/categories",
        payload: { name: "Estudo", color: "#3d99f5" },
      })
    ).json();

    const res = await patch(habit.id, { categoryId: destino.id });

    expect(res.statusCode).toBe(200);
    expect(res.json().categoryId).toBe(destino.id);
    expect((await listHabits())[0]).toMatchObject({
      categoryName: "Estudo",
      color: "#3d99f5",
    });
  });

  test("edits name and category in the same request", async () => {
    const { habit } = await given();
    const destino = (
      await inject({
        method: "POST",
        url: "/categories",
        payload: { name: "Estudo", color: "#3d99f5" },
      })
    ).json();

    const res = await patch(habit.id, {
      name: "Leitura",
      categoryId: destino.id,
    });

    expect(res.json()).toMatchObject({
      name: "Leitura",
      categoryId: destino.id,
    });
  });

  test("editing the name does not archive the habit (active is preserved)", async () => {
    const { habit } = await given();

    expect((await patch(habit.id, { name: "Musculação" })).json().active).toBe(
      true,
    );
  });

  test("archives: active false hides it from the default listing", async () => {
    const { habit } = await given();

    const res = await patch(habit.id, { active: false });

    expect(res.statusCode).toBe(200);
    expect(res.json().active).toBe(false);
    expect(await listHabits()).toHaveLength(0);
    expect(await listHabits(true)).toHaveLength(1);
  });

  test("unarchives: active true brings it back to the listing", async () => {
    const { habit } = await given();
    await patch(habit.id, { active: false });

    await patch(habit.id, { active: true });

    expect(await listHabits()).toHaveLength(1);
  });

  test("archiving does not touch the name", async () => {
    const { habit } = await given();

    expect((await patch(habit.id, { active: false })).json().name).toBe(
      "Academia",
    );
  });

  test("returns 404 for a habit that does not exist", async () => {
    const res = await patch(9999, { name: "Fantasma" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Hábito não encontrado");
  });

  test("returns 404 (not 500) when moving to a category that does not exist", async () => {
    const { habit } = await given();

    const res = await patch(habit.id, { categoryId: 9999 });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Categoria não encontrada");
  });

  test("a rejected move leaves the habit where it was", async () => {
    const { habit, category } = await given();

    await patch(habit.id, { categoryId: 9999 });

    expect((await listHabits())[0].categoryId).toBe(category.id);
  });

  test("rejects a body with no editable field with 400", async () => {
    const { habit } = await given();

    expect((await patch(habit.id, {})).statusCode).toBe(400);
  });

  test("rejects an empty name with 400", async () => {
    const { habit } = await given();

    expect((await patch(habit.id, { name: "   " })).statusCode).toBe(400);
  });

  test("trims the name before saving", async () => {
    const { habit } = await given();

    expect((await patch(habit.id, { name: "  Musculação  " })).json().name).toBe(
      "Musculação",
    );
  });

  test("ignores unknown fields: id is not editable", async () => {
    const { habit } = await given();

    const res = await patch(habit.id, { name: "Musculação", id: 4242 });

    expect(res.json().id).toBe(habit.id);
  });
});
