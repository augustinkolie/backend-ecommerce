import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, toErrorResponse } from "./errors";

describe("toErrorResponse", () => {
  it("formate une AppError", async () => {
    const res = toErrorResponse(AppError.notFound("Produit introuvable"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Produit introuvable" } });
  });

  it("transforme une ZodError en 400 avec les champs", async () => {
    const result = z.object({ email: z.email() }).safeParse({ email: "x" });
    const res = toErrorResponse(result.error);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.email).toHaveLength(1);
  });
});
