import { z } from "zod";

/** Format d'erreur unique : { error: { code, message, fields? } } (section 7). */
export type ErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string[]> };
};

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }

  static badRequest(message: string, fields?: Record<string, string[]>) {
    return new AppError(400, "VALIDATION_ERROR", message, fields);
  }
  static unauthorized(message = "Authentification requise") {
    return new AppError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Accès refusé") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Ressource introuvable") {
    return new AppError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new AppError(409, "CONFLICT", message);
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message, fields: err.fields } };
    return Response.json(body, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    const fields = z.flattenError(err).fieldErrors as Record<string, string[]>;
    const body: ErrorBody = { error: { code: "VALIDATION_ERROR", message: "Données invalides", fields } };
    return Response.json(body, { status: 400 });
  }
  console.error(err);
  const body: ErrorBody = { error: { code: "INTERNAL_ERROR", message: "Erreur interne" } };
  return Response.json(body, { status: 500 });
}
