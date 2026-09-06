import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { beforeEach, describe, expect, test } from "vitest";
import { db } from "../db/client";
import { categories, entries, habits } from "../db/schema";
import { createServer } from "../server";

const app = createServer();

// Sem callback, `app.inject` devolve um encadeável; estreita pra Promise da resposta.
const inject = (opts: InjectOptions): Promise<LightMyRequestResponse> =>
  app.inject(opts);

const post = (payload: InjectOptions["payload"]) =>
  inject({ method: "POST", url: "/categories", payload });

const patch = (id: number, payload: InjectOptions["payload"]) =>
  inject({ method: "PATCH", url: `/categories/${id}`, payload });

/** Cria uma categoria pela API e devolve o corpo, pra usar de ponto de partida. */
const given = async (name = "Saúde", color = "#3fb950") =>
  (await post({ name, color })).json();

beforeEach(() => {
  db.delete(entries).run();
  db.delete(habits).run();
  db.delete(categories).run();
});

describe("POST /categories", () => {
  test("creates with a valid hex and returns 201 with the color untouched", async () => {
    const res = await post({ name: "Saúde", color: "#3fb950" });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Saúde", color: "#3fb950" });
  });

  test("persists the hex: what the POST returns is what the GET lists", async () => {
    const created = (await post({ name: "Estudo", color: "#3d99f5" })).json();
    const listed = (await inject({ url: "/categories" })).json();

    expect(listed).toContainEqual(
      expect.objectContaining({ id: created.id, color: "#3d99f5" }),
    );
  });

  test("accepts uppercase hex", async () => {
    const res = await post({ name: "Trabalho", color: "#BB67E4" });

    expect(res.statusCode).toBe(201);
    expect(res.json().color).toBe("#BB67E4");
  });

  test("rejects a non-hex string with 400 and a message in PT", async () => {
    const res = await post({ name: "Ruim", color: "nao-e-hex" });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/hex #rrggbb/);
    expect(res.json().fields).toContainEqual(
      expect.objectContaining({ field: "color" }),
    );
  });

  test.each([
    ["shorthand #FFF", "#FFF"],
    ["hex with alpha", "#3fb95080"],
    ["missing the #", "3fb950"],
    ["five digits", "#3fb95"],
    ["non-hex letters", "#gggggg"],
    ["empty", ""],
  ])("rejects %s with 400 (FN-008 requires #rrggbb)", async (_label, color) => {
    const res = await post({ name: "Categoria", color });

    expect(res.statusCode).toBe(400);
  });

  test("rejects an empty name with 400", async () => {
    const res = await post({ name: "   ", color: "#3fb950" });

    expect(res.statusCode).toBe(400);
    expect(res.json().fields).toContainEqual(
      expect.objectContaining({ field: "name" }),
    );
  });

  test("nothing is persisted when validation fails", async () => {
    await post({ name: "Fantasma", color: "#FFF" });

    expect((await inject({ url: "/categories" })).json()).toHaveLength(0);
  });
});

describe("GET /categories/:id/graph", () => {
  test("round-trips the hex under `color` (not `colorHue`)", async () => {
    const { id } = (await post({ name: "Saúde", color: "#3fb950" })).json();

    const res = await inject({ url: `/categories/${id}/graph` });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.category).toEqual({ id, name: "Saúde", color: "#3fb950" });
    expect(body.category).not.toHaveProperty("colorHue");
  });

  test("returns 404 for a category that does not exist", async () => {
    const res = await inject({ url: "/categories/9999/graph" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Categoria não encontrada");
  });
});

// [PH-1.2-002] PATCH /categories/:id — editar nome e/ou cor (FN-009)
describe("PATCH /categories/:id", () => {
  test("edits name and color at once and returns 200 with the updated category", async () => {
    const { id } = await given("Saúde", "#3fb950");

    const res = await patch(id, { name: "Bem-estar", color: "#bb67e4" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id,
      name: "Bem-estar",
      color: "#bb67e4",
    });
  });

  test("edits only the name and leaves the color untouched", async () => {
    const { id } = await given("Saúde", "#3fb950");

    const res = await patch(id, { name: "Bem-estar" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "Bem-estar", color: "#3fb950" });
  });

  test("edits only the color and leaves the name untouched", async () => {
    const { id } = await given("Saúde", "#3fb950");

    const res = await patch(id, { color: "#3d99f5" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "Saúde", color: "#3d99f5" });
  });

  test("the edit is persisted, not just echoed back", async () => {
    const { id } = await given("Saúde", "#3fb950");
    await patch(id, { name: "Bem-estar", color: "#bb67e4" });

    const listed = (await inject({ url: "/categories" })).json();

    expect(listed).toContainEqual(
      expect.objectContaining({ id, name: "Bem-estar", color: "#bb67e4" }),
    );
  });

  test("the new color reaches the graph response", async () => {
    const { id } = await given("Saúde", "#3fb950");
    await patch(id, { color: "#bb67e4" });

    const { category } = (
      await inject({ url: `/categories/${id}/graph` })
    ).json();

    expect(category.color).toBe("#bb67e4");
  });

  test("trims the name before saving", async () => {
    const { id } = await given();

    expect((await patch(id, { name: "  Bem-estar  " })).json().name).toBe(
      "Bem-estar",
    );
  });

  test("returns 404 for a category that does not exist", async () => {
    const res = await patch(9999, { name: "Fantasma" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Categoria não encontrada");
  });

  test("rejects an invalid hex with 400, same rule as POST", async () => {
    const { id } = await given();

    const res = await patch(id, { color: "#FFF" });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/hex #rrggbb/);
  });

  test("rejects an empty name with 400", async () => {
    const { id } = await given();

    expect((await patch(id, { name: "   " })).statusCode).toBe(400);
  });

  test("rejects a body with no editable field with 400", async () => {
    const { id } = await given();

    const res = await patch(id, {});

    expect(res.statusCode).toBe(400);
  });

  test("ignores unknown fields: id and createdAt are not editable", async () => {
    const original = await given("Saúde", "#3fb950");

    const res = await patch(original.id, {
      name: "Bem-estar",
      id: 4242,
      createdAt: "1999-01-01 00:00:00",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
    });
  });

  test("a failed edit changes nothing", async () => {
    const original = await given("Saúde", "#3fb950");

    await patch(original.id, { name: "Bem-estar", color: "nao-e-hex" });

    const listed = (await inject({ url: "/categories" })).json();
    expect(listed).toContainEqual(
      expect.objectContaining({ name: "Saúde", color: "#3fb950" }),
    );
  });
});
