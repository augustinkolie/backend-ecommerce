/**
 * Document OpenAPI 3.1 de l'API (section 7).
 * Le frontend en génère ses types : `npm run generate:api` dans frontend/ → lib/api/schema.d.ts.
 * Toute nouvelle route ou réponse publique est ajoutée ici.
 */

type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const arr = (items: Schema): Schema => ({ type: "array", items });
const nullable = (s: Schema): Schema => ({ oneOf: [s, { type: "null" }] });
const str: Schema = { type: "string" };
const int: Schema = { type: "integer" };
const num: Schema = { type: "number" };
const bool: Schema = { type: "boolean" };
const date: Schema = { type: "string", format: "date-time" };
const obj = (properties: Record<string, Schema>, optional: string[] = []): Schema => ({
  type: "object",
  required: Object.keys(properties).filter((k) => !optional.includes(k)),
  properties,
});

/** Enveloppe de succès : { data }. */
const data = (s: Schema) => ({
  description: "Succès",
  content: { "application/json": { schema: obj({ data: s }) } },
});
const errors = {
  "400": { description: "Données invalides", content: { "application/json": { schema: ref("Error") } } },
  "401": { description: "Authentification requise", content: { "application/json": { schema: ref("Error") } } },
  "403": { description: "Accès refusé", content: { "application/json": { schema: ref("Error") } } },
  "404": { description: "Introuvable", content: { "application/json": { schema: ref("Error") } } },
  "429": { description: "Trop de requêtes", content: { "application/json": { schema: ref("Error") } } },
};
const body = (s: Schema) => ({ required: true, content: { "application/json": { schema: s } } });
const pathParam = (name: string) => ({ name, in: "path", required: true, schema: str });
const query = (name: string, schema: Schema = str) => ({ name, in: "query", required: false, schema });

const family: Schema = { type: "string", enum: ["LINEN", "CLOTHING", "TSHIRT", "SHOES"] };
const orderStatus: Schema = { type: "string", enum: ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] };
const role: Schema = { type: "string", enum: ["CUSTOMER", "OWNER", "MANAGER", "SUPPORT", "STOCK"] };
const attribute = obj({ code: str, name: str, value: str });

const schemas: Record<string, Schema> = {
  Error: obj({ error: obj({ code: str, message: str, fields: { type: "object", additionalProperties: arr(str) } }, ["fields"]) }),
  Health: obj({ status: { type: "string", enum: ["ok", "degraded"] }, database: { type: "string", enum: ["up", "down"] }, time: date }),
  ProductCard: obj({
    id: str, slug: str, name: str, family, price: int, compareAtPrice: nullable(int), imageUrl: nullable(str), imageAlt: nullable(str),
    hoverImageUrl: nullable(str), colors: arr(obj({ value: str, hex: nullable(str) })), isNew: bool, inStock: bool,
  }),
  Facet: obj({ code: str, label: str, values: arr(obj({ value: str, label: str, hex: nullable(str), count: int }, ["hex"])) }),
  ProductList: obj({
    items: arr(ref("ProductCard")), nextCursor: nullable(str), total: int, page: int, pageCount: int, facets: arr(ref("Facet")),
    priceRange: nullable(obj({ min: int, max: int })),
    category: nullable(obj({ id: str, name: str, slug: str, path: arr(str) })),
  }, ["total"]),
  CategoryNode: obj({ id: str, name: str, slug: str, image: nullable(str), path: arr(str), children: arr(ref("CategoryNode")) }),
  ProductDetail: obj({
    id: str, slug: str, name: str, description: str, family, material: nullable(str), care: nullable(str),
    details: { type: "object", additionalProperties: str }, seoTitle: nullable(str), seoDescription: nullable(str),
    category: obj({ id: str, name: str, slug: str }),
    breadcrumb: arr(obj({ name: str, slug: str, path: arr(str) })),
    images: arr(obj({ url: str, alt: str, color: nullable(str) })),
    options: arr(obj({ code: str, name: str, values: arr(obj({ value: str, hex: nullable(str) })) })),
    variants: arr(obj({ id: str, sku: str, price: int, compareAtPrice: nullable(int), options: { type: "object", additionalProperties: str } })),
    reviews: obj({ average: nullable(num), count: int }),
    related: arr(ref("ProductCard")),
  }),
  StockLevel: obj({ variantId: str, available: int, low: bool }),
  Review: obj({ id: str, rating: int, text: str, reply: nullable(str), createdAt: date, author: str, verified: bool }),
  CartLine: obj({
    id: str, variantId: str, productId: str, slug: str, name: str, family, sku: str, attributes: arr(attribute), imageUrl: nullable(str),
    unitPrice: int, compareAtPrice: nullable(int), quantity: int, available: int, lineTotal: int,
  }),
  Cart: obj({
    id: nullable(str), currency: str, items: arr(ref("CartLine")), count: int, subtotal: int,
    coupon: nullable(obj({ code: str, type: str, value: int })), discount: int, shippingEstimate: int,
    shippingZone: nullable(obj({ id: str, name: str })), freeShippingThreshold: nullable(int), freeShippingRemaining: nullable(int), total: int,
  }),
  ShippingZone: obj({ id: str, name: str, cities: arr(str), price: int, freeAbove: nullable(int), isPickup: bool, delay: nullable(str) }),
  PublicSettings: obj({
    shopName: str, currency: str, locale: str, contactEmail: str, contactPhone: str, address: str, freeShippingThreshold: nullable(int),
    paymentMethods: arr(obj({ code: str, label: str })), shippingZones: arr(ref("ShippingZone")),
  }),
  User: obj({ id: str, email: str, name: nullable(str), phone: nullable(str), role, permissions: arr(str), hasPassword: bool }, ["hasPassword"]),
  Address: obj({ id: str, name: str, line1: str, line2: nullable(str), city: str, country: str, phone: str, isDefault: bool }),
  ContentBlock: obj({ id: str, slot: str, title: str, subtitle: nullable(str), imageUrl: nullable(str), linkUrl: nullable(str), linkLabel: nullable(str), position: int, active: bool }),
  HeroProduct: obj({
    id: str, slug: str, name: str, price: int, compareAtPrice: nullable(int), imageUrl: nullable(str), imageAlt: nullable(str),
    x: { type: "number", minimum: 0, maximum: 100, description: "Position horizontale du point, en % de la photo" },
    y: { type: "number", minimum: 0, maximum: 100, description: "Position verticale du point, en % de la photo" },
  }),
  HomeContent: obj({
    hero: arr(ref("ContentBlock")), heroProducts: arr(ref("HeroProduct")), featured: arr(ref("ContentBlock")), collections: arr(obj({ name: str, slug: str })),
    newArrivals: arr(ref("ProductCard")), bestSellers: arr(ref("ProductCard")), freeShippingThreshold: nullable(int),
  }),
  LegalPage: obj({ slug: str, title: str, body: str, updatedAt: date }),
  PublicOrder: obj({
    id: str, number: int, status: orderStatus, total: int, currency: str, email: str, paymentMethod: str, shippingMethod: str, createdAt: date,
    items: arr(obj({ name: str, quantity: int, unitPrice: int, attributes: arr(obj({ value: str })) })),
  }),
  CheckoutResult: obj({ orderId: str, number: int, status: orderStatus, total: int, redirectUrl: nullable(str) }),
  CheckoutInput: obj({
    email: str,
    address: obj({ name: str, phone: str, line1: str, line2: str, city: str, country: str }, ["line1", "line2", "city", "country"]),
    shippingZoneId: str, paymentMethod: str, saveAddress: bool, note: str,
  }, ["saveAddress", "note"]),
};

const tag = (t: string, summary: string, extra: Record<string, unknown> = {}) => ({ tags: [t], summary, ...extra });

/** Routes admin : protégées par rôle, réponses { data } (détail des schémas dans le code des modules). */
const admin = (summary: string, methods: string[], permission: string) =>
  Object.fromEntries(methods.map((m) => [m, { ...tag("Admin", summary), description: `Permission requise : ${permission}.`, responses: { "200": { description: "Succès" }, ...errors } }]));

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Boutique API",
    version: "1.0.0",
    description: "API REST de la boutique. Succès : `{ data }` ; erreur : `{ error: { code, message, fields? } }`. Pagination par curseur (`?cursor=&limit=`) ou par numéro de page (`?page=&limit=`, réponse avec `page` et `pageCount`). Montants en entiers (plus petite unité de la devise).",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    schemas,
    securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "at" } },
  },
  paths: {
    "/health": { get: { ...tag("Système", "État du service"), responses: { "200": data(ref("Health")), "503": { description: "Base indisponible" } } } },

    // ---------------- Authentification
    "/auth/register": { post: { ...tag("Auth", "Inscription (pose les cookies at/rt)"), requestBody: body(obj({ email: str, password: str, name: str, phone: str }, ["phone"])), responses: { "201": data(ref("User")), ...errors } } },
    "/auth/login": { post: { ...tag("Auth", "Connexion"), requestBody: body(obj({ email: str, password: str })), responses: { "200": data(ref("User")), ...errors } } },
    "/auth/refresh": { post: { ...tag("Auth", "Rotation du refresh token"), responses: { "200": data(ref("User")), ...errors } } },
    "/auth/logout": { post: { ...tag("Auth", "Déconnexion"), responses: { "200": data(obj({ loggedOut: bool })) } } },
    "/auth/magic/request": { post: { ...tag("Auth", "Envoi d'un lien magique"), requestBody: body(obj({ email: str })), responses: { "200": data(obj({ sent: bool })), ...errors } } },
    "/auth/magic/verify": { post: { ...tag("Auth", "Connexion par lien magique"), requestBody: body(obj({ token: str })), responses: { "200": data(ref("User")), ...errors } } },

    // ---------------- Catalogue
    "/products": {
      get: {
        ...tag("Catalogue", "Liste filtrable avec facettes"),
        parameters: ["category", "collection", "family", "size", "shoe_size", "dimension", "color", "material", "price_min", "price_max", "on_sale", "sort", "cursor", "page", "limit"].map((n) => query(n)),
        responses: { "200": data(ref("ProductList")), ...errors },
      },
    },
    "/products/{slug}": { get: { ...tag("Catalogue", "Fiche produit"), parameters: [pathParam("slug")], responses: { "200": data(ref("ProductDetail")), ...errors } } },
    "/products/{slug}/stock": { get: { ...tag("Catalogue", "Stock temps réel (le segment est l'id produit)"), parameters: [pathParam("slug")], responses: { "200": data(arr(ref("StockLevel"))) } } },
    "/products/{slug}/reviews": {
      get: { ...tag("Avis", "Avis publiés (le segment est l'id produit)"), parameters: [pathParam("slug")], responses: { "200": data(arr(ref("Review"))) } },
      post: { ...tag("Avis", "Publier un avis (achat vérifié)"), parameters: [pathParam("slug")], requestBody: body(obj({ rating: int, text: str })), responses: { "201": data(obj({ id: str, status: str })), ...errors } },
    },
    "/products/alerts": { post: { ...tag("Catalogue", "Alerte retour en stock"), requestBody: body(obj({ variantId: str, email: str })), responses: { "201": data(obj({ subscribed: bool })), ...errors } } },
    "/categories": { get: { ...tag("Catalogue", "Arborescence des catégories"), responses: { "200": data(arr(ref("CategoryNode"))) } } },
    "/collections/{slug}": { get: { ...tag("Catalogue", "Collection et ses produits"), parameters: [pathParam("slug")], responses: { "200": data({ allOf: [ref("ProductList"), obj({ collection: obj({ id: str, name: str, slug: str, type: str }) })] }), ...errors } } },
    "/search": { get: { ...tag("Catalogue", "Recherche instantanée (Meilisearch)"), parameters: [query("q"), query("page", int), query("limit", int)], responses: { "200": data(obj({ items: arr(ref("ProductCard")), total: int, page: int, pageCount: int, engine: str })) } } },

    // ---------------- Contenu
    "/content/home": { get: { ...tag("Contenu", "Accueil"), responses: { "200": data(ref("HomeContent")) } } },
    "/pages/{slug}": { get: { ...tag("Contenu", "Page légale"), parameters: [pathParam("slug")], responses: { "200": data(ref("LegalPage")), ...errors } } },
    "/settings": { get: { ...tag("Contenu", "Paramètres publics"), responses: { "200": data(ref("PublicSettings")) } } },

    // ---------------- Panier & commande
    "/cart": { get: { ...tag("Panier", "Panier courant (invité ou compte)"), parameters: [query("city")], responses: { "200": data(ref("Cart")) } } },
    "/cart/items": { post: { ...tag("Panier", "Ajouter un article"), requestBody: body(obj({ variantId: str, quantity: int }, ["quantity"])), responses: { "201": data(ref("Cart")), ...errors } } },
    "/cart/items/{id}": {
      patch: { ...tag("Panier", "Modifier la quantité"), parameters: [pathParam("id")], requestBody: body(obj({ quantity: int })), responses: { "200": data(ref("Cart")), ...errors } },
      delete: { ...tag("Panier", "Retirer un article"), parameters: [pathParam("id")], responses: { "200": data(ref("Cart")), ...errors } },
    },
    "/cart/coupon": {
      post: { ...tag("Panier", "Appliquer un code promo"), requestBody: body(obj({ code: str })), responses: { "200": data(ref("Cart")), ...errors } },
      delete: { ...tag("Panier", "Retirer le code promo"), responses: { "200": data(ref("Cart")) } },
    },
    "/checkout": {
      post: {
        ...tag("Commande", "Crée la commande, réserve le stock 15 min, lance le paiement"),
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: str }],
        requestBody: body(ref("CheckoutInput")),
        responses: { "201": data(ref("CheckoutResult")), "200": data(ref("CheckoutResult")), "409": { description: "Stock insuffisant", content: { "application/json": { schema: ref("Error") } } }, ...errors },
      },
    },
    "/orders/{id}": { get: { ...tag("Commande", "Récapitulatif de confirmation"), parameters: [pathParam("id")], responses: { "200": data(ref("PublicOrder")), ...errors } } },
    "/webhooks/payments/{provider}": {
      post: {
        ...tag("Paiement", "Confirmation de paiement (signature HMAC-SHA256 en en-tête x-signature)"),
        parameters: [pathParam("provider"), { name: "x-signature", in: "header", required: true, schema: str }],
        requestBody: body(obj({ orderId: str, externalRef: str, amount: int, status: { type: "string", enum: ["succeeded", "failed"] } })),
        responses: { "200": data(obj({ orderId: str, status: orderStatus, duplicate: bool })), ...errors },
      },
    },
    "/payments/test/simulate": { post: { ...tag("Paiement", "Simulateur de carte (recette)"), requestBody: body(obj({ orderId: str, outcome: { type: "string", enum: ["succeeded", "failed"] } })), responses: { "200": data(obj({ orderId: str, status: orderStatus, duplicate: bool })), ...errors } } },

    // ---------------- Compte client
    "/me": {
      get: { ...tag("Compte", "Profil"), security: [{ cookieAuth: [] }], responses: { "200": data(ref("User")), ...errors } },
      patch: { ...tag("Compte", "Modifier le profil"), security: [{ cookieAuth: [] }], requestBody: body(obj({ name: str, phone: str }, ["phone"])), responses: { "200": data(ref("User")), ...errors } },
    },
    "/me/password": { post: { ...tag("Compte", "Changer de mot de passe"), security: [{ cookieAuth: [] }], requestBody: body(obj({ current: str, next: str }, ["current"])), responses: { "200": data(obj({ updated: bool })), ...errors } } },
    "/me/orders": { get: { ...tag("Compte", "Mes commandes"), security: [{ cookieAuth: [] }], responses: { "200": { description: "Succès" }, ...errors } } },
    "/me/orders/{number}": { get: { ...tag("Compte", "Détail d'une commande"), security: [{ cookieAuth: [] }], parameters: [pathParam("number")], responses: { "200": { description: "Succès" }, ...errors } } },
    "/me/addresses": {
      get: { ...tag("Compte", "Mes adresses"), security: [{ cookieAuth: [] }], responses: { "200": data(arr(ref("Address"))) } },
      post: { ...tag("Compte", "Ajouter une adresse"), security: [{ cookieAuth: [] }], responses: { "201": data(ref("Address")), ...errors } },
    },
    "/me/addresses/{id}": {
      patch: { ...tag("Compte", "Modifier une adresse"), security: [{ cookieAuth: [] }], parameters: [pathParam("id")], responses: { "200": data(ref("Address")), ...errors } },
      delete: { ...tag("Compte", "Supprimer une adresse"), security: [{ cookieAuth: [] }], parameters: [pathParam("id")], responses: { "200": data(obj({ deleted: bool })), ...errors } },
    },
    "/me/wishlist": {
      get: { ...tag("Compte", "Favoris"), security: [{ cookieAuth: [] }], responses: { "200": data(arr(ref("ProductCard"))) } },
      post: { ...tag("Compte", "Ajouter aux favoris"), security: [{ cookieAuth: [] }], requestBody: body(obj({ productId: str })), responses: { "201": data(obj({ productId: str })), ...errors } },
    },
    "/me/wishlist/{productId}": { delete: { ...tag("Compte", "Retirer des favoris"), security: [{ cookieAuth: [] }], parameters: [pathParam("productId")], responses: { "200": data(obj({ productId: str })) } } },
    "/me/returns": {
      get: { ...tag("Compte", "Mes retours"), security: [{ cookieAuth: [] }], responses: { "200": { description: "Succès" } } },
      post: { ...tag("Compte", "Demander un retour"), security: [{ cookieAuth: [] }], requestBody: body(obj({ orderNumber: int, reason: str, items: arr(obj({ orderItemId: str, quantity: int })) })), responses: { "201": { description: "Créé" }, ...errors } },
    },

    // ---------------- Admin
    "/admin/stats": admin("Tableau de bord (?range=1d|7d|30d|90d)", ["get"], "dashboard"),
    "/admin/search": admin("Palette Ctrl/Cmd+K", ["get"], "équipe"),
    "/admin/products": admin("Liste / création de produits", ["get", "post"], "products"),
    "/admin/products/bulk": admin("Actions groupées", ["post"], "products"),
    "/admin/products/{id}": admin("Lecture / mise à jour / suppression logique", ["get", "put", "delete"], "products"),
    "/admin/products/{id}/duplicate": admin("Duplication", ["post"], "products"),
    "/admin/variants/{id}": admin("Édition en ligne d'une variante", ["patch"], "products"),
    "/admin/categories": admin("Catégories", ["get", "post"], "products"),
    "/admin/categories/reorder": admin("Réordonner l'arborescence", ["post"], "products"),
    "/admin/categories/{id}": admin("Modifier / supprimer une catégorie", ["put", "delete"], "products"),
    "/admin/collections": admin("Collections", ["get", "post"], "products"),
    "/admin/collections/{id}": admin("Collection", ["get", "put", "delete"], "products"),
    "/admin/attributes": admin("Types d'attributs", ["get", "post"], "products"),
    "/admin/attributes/{id}": admin("Modifier un type d'attribut", ["put"], "products"),
    "/admin/attributes/{id}/values": admin("Ajouter une valeur", ["post"], "products"),
    "/admin/attribute-values/{id}": admin("Modifier / supprimer une valeur", ["put", "delete"], "products"),
    "/admin/stock": admin("Niveaux de stock", ["get"], "stock"),
    "/admin/stock/adjust": admin("Mouvement de stock", ["post"], "stock"),
    "/admin/stock/movements": admin("Historique des mouvements", ["get"], "stock"),
    "/admin/stock/export": admin("Export CSV", ["get"], "stock"),
    "/admin/stock/import": admin("Import CSV (sku;stock;seuil_alerte)", ["post"], "stock"),
    "/admin/orders": admin("Commandes filtrables", ["get"], "orders"),
    "/admin/orders/export": admin("Export CSV", ["get"], "orders"),
    "/admin/orders/{id}": admin("Détail", ["get"], "orders"),
    "/admin/orders/{id}/status": admin("Changement de statut", ["post"], "orders.status"),
    "/admin/orders/{id}/refund": admin("Remboursement total ou partiel", ["post"], "orders.refund"),
    "/admin/orders/{id}/notes": admin("Note interne", ["post"], "orders"),
    "/admin/orders/{id}/invoice": admin("Facture PDF", ["get"], "orders"),
    "/admin/orders/{id}/packing-slip": admin("Bon de préparation PDF", ["get"], "orders"),
    "/admin/returns": admin("Retours", ["get"], "orders"),
    "/admin/returns/{id}": admin("Statut d'un retour", ["patch"], "orders.status"),
    "/admin/customers": admin("Clients", ["get"], "customers"),
    "/admin/customers/{id}": admin("Fiche client, notes, blocage", ["get", "patch"], "customers"),
    "/admin/coupons": admin("Codes promo", ["get", "post"], "promotions"),
    "/admin/coupons/{id}": admin("Code promo", ["put", "delete"], "promotions"),
    "/admin/sales": admin("Soldes par catégorie", ["get", "post"], "promotions"),
    "/admin/sales/{id}": admin("Soldes", ["put", "delete"], "promotions"),
    "/admin/reviews": admin("Avis à modérer", ["get"], "reviews"),
    "/admin/reviews/{id}": admin("Approuver, masquer, répondre", ["patch"], "reviews"),
    "/admin/content/blocks": admin("Bandeaux d'accueil", ["get", "post"], "content"),
    "/admin/content/blocks/{id}": admin("Bandeau", ["put", "delete"], "content"),
    "/admin/content/pages": admin("Pages légales", ["get"], "content"),
    "/admin/content/pages/{slug}": admin("Modifier une page", ["put"], "content"),
    "/admin/settings": admin("Paramètres boutique", ["get", "put"], "settings"),
    "/admin/shipping-zones": admin("Zones de livraison", ["get", "post"], "settings"),
    "/admin/shipping-zones/{id}": admin("Zone", ["put", "delete"], "settings"),
    "/admin/search-index": admin("Réindexation Meilisearch", ["post"], "settings"),
    "/admin/team": admin("Équipe", ["get", "post"], "team"),
    "/admin/team/{id}": admin("Rôle / activation", ["patch"], "team"),
    "/admin/audit": admin("Journal d'audit", ["get"], "team"),
    "/admin/uploads": admin("URL d'upload signée", ["post"], "products"),
    "/admin/uploads/local": admin("Réception binaire (stockage local)", ["post"], "products"),
    "/internal/jobs": { post: { ...tag("Système", "Tâches planifiées (en-tête x-jobs-secret)"), responses: { "200": { description: "Résultats" }, ...errors } } },
  },
} as const;
