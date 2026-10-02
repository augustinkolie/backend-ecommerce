import { isProd } from "./env";

export const COOKIE = {
  access: "at",
  refresh: "rt",
  cart: "cid",
} as const;

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd()) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name: string) {
  return serializeCookie(name, "", 0);
}
