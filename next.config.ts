import type { NextConfig } from "next";

const frontend = process.env.FRONTEND_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // Image Docker de production minimale (node server.js), sans effet en développement.
  output: "standalone",
  // Dossier de build séparé possible (mesures de performance pendant que le serveur de dev tourne).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // API JSON : aucune ressource active autorisée.
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; img-src 'self'" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // CORS limité au domaine du frontend.
          { key: "Access-Control-Allow-Origin", value: frontend },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "content-type, idempotency-key, x-service-key" },
          { key: "Vary", value: "Origin" },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }],
      },
    ];
  },
};

export default nextConfig;
