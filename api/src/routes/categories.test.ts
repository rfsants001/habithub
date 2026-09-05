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
