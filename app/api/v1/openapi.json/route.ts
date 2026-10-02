import { openApiDocument } from "@/src/lib/openapi";

/** Spec OpenAPI : source des types du frontend (openapi-typescript). */
export function GET() {
  return Response.json(openApiDocument);
}
