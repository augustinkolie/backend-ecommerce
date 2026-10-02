# API backend — image de production (Next.js standalone).
# Construire : docker compose -f docker-compose.prod.yml build backend
FROM node:24-alpine AS deps
WORKDIR /app
# Valeurs factices pour « prisma generate » et le build (aucune connexion) ; les vraies sont fournies au démarrage.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build JWT_SECRET=build-only-secret-at-least-32-characters NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# Étape « outils » : migrations, seed, tâches planifiées (dépendances complètes).
FROM build AS tools
ENV NODE_ENV=production
CMD ["npm", "run", "jobs"]

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=4000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Images envoyées depuis l'admin (pilote « local ») : à monter en volume.
RUN mkdir -p public/uploads && chown -R app:app public/uploads
USER app
EXPOSE 4000
CMD ["node", "server.js"]
