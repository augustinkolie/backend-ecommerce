# Règles backend — à respecter sans exception

## Rôle
API REST seule (Next.js, Route Handlers sous app/api/v1/...). Aucune page, aucun composant React.
Le frontend n'accède jamais à la base : tout passe par cette API.

## Architecture : route → service → repository
- `app/api/v1/**/route.ts` : lit la requête, valide avec Zod, appelle le service, renvoie `ok(data)`.
  AUCUNE logique métier ici. Toujours envelopper avec `handle()` (src/lib/http.ts).
- `src/modules/<module>/schema.ts` : schémas Zod d'entrée/sortie.
- `src/modules/<module>/service.ts` : règles métier (prix, stock, statuts, droits).
- `src/modules/<module>/repository.ts` : seul endroit qui appelle Prisma.
- `src/jobs/` : tâches planifiées (libération des réservations, paniers abandonnés J+1, avis J+7).

## Validation
- Zod obligatoire sur CHAQUE entrée : corps (`parseBody`), query (`parseQuery`), params, en-têtes utiles.
- Prix toujours recalculés côté serveur, jamais pris depuis le client.

## Format des réponses (section 7)
- Succès : `{ data }`. Erreur : `{ error: { code, message, fields? } }`, codes HTTP corrects.
- Lever `AppError` (src/lib/errors.ts) ; ne jamais construire une réponse d'erreur à la main.
- Pagination par curseur (`?cursor=&limit=`), filtres en query string.
- Routes admin sous `/api/v1/admin/*`, protégées par rôle.
- `Idempotency-Key` obligatoire sur création de commande et de paiement.

## Données
- Montants en entiers (plus petite unité de la devise). Prix et stock sur ProductVariant, jamais sur Product.
- Suppression logique (`deletedAt`) pour produits et clients.
- Lignes de commande : copies figées (nom, sku, attributs, prix).
- Stock : réservé 15 min au checkout, confirmé par le webhook dans une transaction, libéré par un job.
- Toute action admin modifiante écrit un AuditLog (avant/après).

## Sécurité
- Argon2 pour les mots de passe ; JWT 15 min + refresh token rotatif ; cookies httpOnly, Secure, SameSite=Lax.
- Signature vérifiée sur tous les webhooks de paiement ; aucun numéro de carte stocké.
- Limitation de débit sur connexion, inscription, checkout.

## Documentation
- Chaque nouvelle route est ajoutée à src/lib/openapi.ts (le frontend en génère ses types).
- Avant de terminer : `npm run lint && npm run typecheck && npm test`.

@AGENTS.md
