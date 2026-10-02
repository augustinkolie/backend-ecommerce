/**
 * Jeu de données de démonstration : `npm run db:seed`.
 * 44 produits sur 4 familles, comptes de démo (un par rôle), commandes, avis, contenus.
 */
import "dotenv/config";
import path from "node:path";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../src/generated/prisma/client";
import { COLORS, DEFS, SIZE_VALUES, SHOE_VALUES, DIM_VALUES, PILLOW_VALUES, LINEN_CARE, CLOTH_CARE, SHOE_CARE } from "./catalog-data";
import { revalidateFrontend } from "../src/lib/revalidate";
import { demoImage } from "./demo-images";
import { ensureDemoPhotos, loadManifest, photoFile } from "./fetch-demo-photos";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const PUBLIC_API = process.env.PUBLIC_API_URL ?? "http://localhost:4000";
const UPLOADS = path.join(process.cwd(), "public", "uploads");

// PRNG déterministe : mêmes données à chaque seed.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

// Photos réelles (prisma/demo-photos.json) si elles sont disponibles, silhouettes générées sinon.
const manifest = loadManifest();
let photos = false;
const productVisuals = (d: (typeof DEFS)[number], color: string) => {
  const real = photos ? manifest?.products[d.name]?.[color] : undefined;
  if (real?.length) return real.map((p) => photoFile(p));
  return ([0, 1] as const).map((v) => demoImage(UPLOADS, d.shape, COLORS[color]!, v, d.family === "LINEN"));
};
const contentVisual = (key: string, fallback: () => string) => {
  const p = photos ? manifest?.content[key] : undefined;
  return `${PUBLIC_API}/uploads/${p ? photoFile(p) : fallback()}`;
};

async function reset() {
  // Ordre compatible avec les clés étrangères.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.orderEvent.deleteMany(), prisma.returnRequest.deleteMany(), prisma.payment.deleteMany(),
    prisma.shipment.deleteMany(), prisma.orderItem.deleteMany(), prisma.order.deleteMany(), prisma.cartItem.deleteMany(), prisma.cart.deleteMany(),
    prisma.review.deleteMany(), prisma.wishlistItem.deleteMany(), prisma.backInStockAlert.deleteMany(), prisma.stockMovement.deleteMany(),
    prisma.productImage.deleteMany(), prisma.productVariant.deleteMany(), prisma.product.deleteMany(), prisma.collection.deleteMany(),
    prisma.attributeValue.deleteMany(), prisma.attributeType.deleteMany(), prisma.categorySale.deleteMany(), prisma.category.deleteMany(),
    prisma.coupon.deleteMany(), prisma.address.deleteMany(), prisma.refreshToken.deleteMany(), prisma.magicLinkToken.deleteMany(),
    prisma.user.deleteMany(), prisma.shippingZone.deleteMany(), prisma.setting.deleteMany(), prisma.contentBlock.deleteMany(), prisma.page.deleteMany(),
  ]);
}

async function main() {
  if (manifest) photos = await ensureDemoPhotos(UPLOADS, manifest);
  if (!photos) console.log("Photos réelles indisponibles : visuels générés à la place.");
  console.log("Réinitialisation…");
  await reset();

  // ---------------- Utilisateurs (un compte de démo par rôle)
  const passwordHash = await hash("Demo1234!");
  const users: Record<string, { id: string }> = {};
  const accounts: [string, string, Role][] = [
    ["proprietaire@leppi.local", "Aïssatou Diallo", "OWNER"],
    ["gestionnaire@leppi.local", "Mamadou Bah", "MANAGER"],
    ["service-client@leppi.local", "Fatoumata Camara", "SUPPORT"],
    ["magasinier@leppi.local", "Ibrahima Sylla", "STOCK"],
    ["client@leppi.local", "Mariama Barry", "CUSTOMER"],
  ];
  for (const [email, name, role] of accounts) {
    users[role] = await prisma.user.create({ data: { email, name, role, passwordHash, phone: "+224 620 00 00 0" + int(0, 9) } });
  }
  const firstNames = ["Kadiatou", "Ousmane", "Hawa", "Alpha", "Nènè", "Sékou", "Aminata", "Thierno", "Djénabou", "Lansana", "Oumou", "Boubacar"];
  const lastNames = ["Diallo", "Bah", "Camara", "Sow", "Barry", "Condé", "Touré", "Keïta", "Soumah", "Kourouma"];
  const customers = [users.CUSTOMER!];
  for (let i = 0; i < 24; i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    customers.push(await prisma.user.create({ data: { email: `${fn}.${ln}.${i}@exemple.gn`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), name: `${fn} ${ln}`, passwordHash } }));
  }
  await prisma.address.create({ data: { userId: users.CUSTOMER!.id, name: "Mariama Barry", line1: "Rue KA-020, Kaloum", city: "Conakry", country: "Guinée", phone: "+224 620 11 22 33", isDefault: true } });

  // ---------------- Paramètres, zones, contenus
  await prisma.setting.create({
    data: {
      key: "shop",
      value: {
        shopName: "Leppi", currency: "GNF", locale: "fr-FR", taxRate: 180, pricesIncludeTax: true,
        paymentMethods: [
          { code: "cash_on_delivery", label: "Paiement à la livraison", enabled: true },
          { code: "orange_money", label: "Orange Money", enabled: false },
          { code: "mtn_momo", label: "MTN MoMo", enabled: false },
          { code: "test_card", label: "Carte bancaire (test)", enabled: true },
        ],
        contactEmail: "bonjour@leppi.local", contactPhone: "+224 620 00 00 00", address: "Avenue de la République, Kaloum, Conakry",
        freeShippingThreshold: 1_000_000, emails: { abandonedCart: true, reviewRequest: true, backInStock: true },
      },
    },
  });
  const zones = await Promise.all([
    prisma.shippingZone.create({ data: { name: "Conakry — livraison à domicile", cities: ["Conakry", "Kaloum", "Dixinn", "Matam", "Ratoma", "Matoto"], price: 30_000, delay: "24 à 48 h", position: 0 } }),
    prisma.shippingZone.create({ data: { name: "Retrait en boutique (Kaloum)", cities: [], price: 0, isPickup: true, delay: "Prêt en 2 h", position: 1 } }),
    prisma.shippingZone.create({ data: { name: "Autres villes de Guinée", cities: [], price: 75_000, freeAbove: 1_500_000, delay: "3 à 5 jours", position: 2 } }),
  ]);

  const pages: [string, string, string][] = [
    ["cgv", "Conditions générales de vente", "## Objet\nLes présentes conditions régissent les ventes réalisées sur la boutique Leppi.\n\n## Prix\nLes prix sont indiqués en francs guinéens (GNF), toutes taxes comprises. Ils sont recalculés au moment de la commande.\n\n## Commande\nLa commande est ferme après validation du paiement, ou dès sa confirmation pour le paiement à la livraison.\n\n## Paiement\nPaiement à la livraison, Orange Money, MTN MoMo ou carte bancaire. Aucune donnée de carte n'est conservée par la boutique.\n\n## Droit de retour\nVous disposez de 14 jours après réception pour retourner un article non porté, dans son emballage d'origine."],
    ["livraison", "Livraison", "## Conakry\nLivraison à domicile en 24 à 48 h : 30 000 GNF, offerte dès 1 000 000 GNF d'achat.\n\n## Retrait en boutique\nGratuit, commande prête en 2 h à notre boutique de Kaloum.\n\n## Autres villes\nLivraison en 3 à 5 jours : 75 000 GNF, offerte dès 1 500 000 GNF."],
    ["retours", "Retours et échanges", "## Délai\n14 jours après réception.\n\n## Procédure\nDepuis votre compte, rubrique Retours, sélectionnez les articles et le motif. Nous vous recontactons sous 48 h.\n\n## Remboursement\nLe remboursement est effectué sur le moyen de paiement d'origine dès réception et contrôle des articles."],
    ["confidentialite", "Politique de confidentialité", "## Données collectées\nNom, e-mail, téléphone et adresse de livraison, uniquement pour traiter vos commandes.\n\n## Paiement\nAucun numéro de carte n'est stocké par la boutique.\n\n## Vos droits\nVous pouvez demander l'accès, la rectification ou la suppression de vos données à bonjour@leppi.local."],
  ];
  for (const [slug, title, body] of pages) await prisma.page.create({ data: { slug, title, body } });

  // ---------------- Catégories
  const tree: [string, string, [string, string][]][] = [
    ["Linge de maison", "linge-de-maison", [["Draps", "draps"], ["Housses de couette", "housses-de-couette"], ["Taies", "taies"], ["Couvre-matelas", "couvre-matelas"]]],
    ["Vêtements", "vetements", [["Chemises", "chemises"], ["Robes", "robes"], ["Pantalons", "pantalons"]]],
    ["T-shirts", "t-shirts", [["Basiques", "basiques"], ["Imprimés", "imprimes"]]],
    ["Chaussures", "chaussures", [["Baskets", "baskets"], ["Sandales", "sandales"], ["Chaussures de ville", "chaussures-de-ville"]]],
  ];
  const catIds: Record<string, string> = {};
  for (const [i, [name, slug, children]] of tree.entries()) {
    const parent = await prisma.category.create({ data: { name, slug, position: i } });
    catIds[slug] = parent.id;
    for (const [j, [cname, cslug]] of children.entries()) {
      catIds[cslug] = (await prisma.category.create({ data: { name: cname, slug: cslug, parentId: parent.id, position: j } })).id;
    }
  }

  // ---------------- Attributs
  const size = await prisma.attributeType.create({ data: { code: "size", name: "Taille", families: ["CLOTHING", "TSHIRT"], position: 1 } });
  const shoe = await prisma.attributeType.create({ data: { code: "shoe_size", name: "Pointure", families: ["SHOES"], position: 1 } });
  const dim = await prisma.attributeType.create({ data: { code: "dimension", name: "Dimension", families: ["LINEN"], position: 1 } });
  const color = await prisma.attributeType.create({ data: { code: "color", name: "Coloris", families: ["LINEN", "CLOTHING", "TSHIRT", "SHOES"], position: 0 } });
  const val: Record<string, string> = {};
  for (const [i, v] of SIZE_VALUES.entries()) val[`size:${v}`] = (await prisma.attributeValue.create({ data: { typeId: size.id, value: v, position: i } })).id;
  for (const [i, v] of SHOE_VALUES.entries()) val[`shoe:${v}`] = (await prisma.attributeValue.create({ data: { typeId: shoe.id, value: v, position: i } })).id;
  for (const [i, v] of [...DIM_VALUES, ...PILLOW_VALUES].entries()) val[`dim:${v}`] = (await prisma.attributeValue.create({ data: { typeId: dim.id, value: v, position: i } })).id;
  for (const [i, [name, h]] of Object.entries(COLORS).entries()) val[`color:${name}`] = (await prisma.attributeValue.create({ data: { typeId: color.id, value: name, hex: h, position: i } })).id;

  // ---------------- Produits
  console.log("Produits et visuels…");
  const slugs = new Set<string>();
  const productIds: string[] = [];
  const variantPool: { id: string; productId: string; name: string; sku: string; price: number; attrs: { code: string; name: string; value: string }[] }[] = [];
  for (const [idx, d] of DEFS.entries()) {
    let slug = d.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slugs.has(slug)) slug += `-${idx}`;
    slugs.add(slug);
    const daysAgo = idx % 5 === 0 ? int(1, 20) : int(35, 200);
    const product = await prisma.product.create({
      data: {
        name: d.name, slug, description: d.description, family: d.family, material: d.material, details: d.details,
        care: d.family === "SHOES" ? SHOE_CARE : d.family === "LINEN" ? LINEN_CARE : CLOTH_CARE,
        status: "PUBLISHED", publishedAt: new Date(Date.now() - daysAgo * 86400_000), categoryId: catIds[d.cat]!,
        seoTitle: `${d.name} — Leppi`, seoDescription: d.description.slice(0, 155),
      },
    });
    productIds.push(product.id);

    let pos = 0;
    for (const c of d.colors) {
      for (const [v, rel] of productVisuals(d, c).entries()) {
        await prisma.productImage.create({ data: { productId: product.id, url: `${PUBLIC_API}/uploads/${rel}`, alt: `${d.name}, coloris ${c}${v ? ", vue 2" : ""}`, position: pos++, colorValueId: val[`color:${c}`] } });
      }
    }

    const dims: { key: string; code: string; name: string; value: string; delta: number }[] =
      d.family === "LINEN"
        ? (d.shape === "pillow" ? PILLOW_VALUES : DIM_VALUES).map((v, i) => ({ key: `dim:${v}`, code: "dimension", name: "Dimension", value: v, delta: i * Math.round(d.price * 0.15 / 10_000) * 10_000 }))
        : d.family === "SHOES"
          ? SHOE_VALUES.map((v) => ({ key: `shoe:${v}`, code: "shoe_size", name: "Pointure", value: v, delta: 0 }))
          : SIZE_VALUES.map((v) => ({ key: `size:${v}`, code: "size", name: "Taille", value: v, delta: 0 }));
    const prefix = d.family.slice(0, 2) + String(idx + 1).padStart(3, "0");
    for (const c of d.colors) {
      for (const dm of dims) {
        const stock = rand() < 0.12 ? 0 : rand() < 0.2 ? int(1, 3) : int(4, 40);
        const sku = `${prefix}-${c.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase()}-${dm.value.replace("×", "X")}`;
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id, sku, price: d.price + dm.delta, compareAtPrice: d.compareAt ? d.compareAt + dm.delta : null,
            stock, lowStockAlert: 3, weightGrams: d.family === "SHOES" ? 900 : d.family === "LINEN" ? 700 : 250,
            attributeValues: { connect: [{ id: val[`color:${c}`]! }, { id: val[dm.key]! }] },
          },
        });
        if (stock) await prisma.stockMovement.create({ data: { variantId: variant.id, type: "IN", quantity: stock, reason: "Stock initial" } });
        variantPool.push({ id: variant.id, productId: product.id, name: d.name, sku, price: variant.price, attrs: [{ code: "color", name: "Coloris", value: c }, { code: dm.code, name: dm.name, value: dm.value }] });
      }
    }
  }

  // ---------------- Collections, soldes, codes promo
  await prisma.collection.create({ data: { name: "Nouveautés", slug: "nouveautes", type: "AUTO", rules: { newDays: 30 } } });
  await prisma.collection.create({ data: { name: "Tout en lin", slug: "tout-en-lin", type: "AUTO", rules: { material: "Lin" } } });
  await prisma.collection.create({
    data: {
      name: "L'essentiel de l'été", slug: "essentiel-ete", type: "MANUAL",
      products: { connect: productIds.filter((_, i) => [1, 11, 14, 17, 22, 26, 37, 38].includes(i)).map((id) => ({ id })) },
    },
  });
  await prisma.categorySale.create({ data: { name: "Soldes imprimés", categoryId: catIds.imprimes!, percent: 20, startsAt: new Date(Date.now() - 3 * 86400_000), endsAt: new Date(Date.now() + 20 * 86400_000) } });
  await prisma.coupon.createMany({
    data: [
      { code: "BIENVENUE10", type: "PERCENT", value: 10 },
      { code: "LIVRAISON", type: "FREE_SHIPPING", value: 0, minimum: 300_000 },
      { code: "ETE50K", type: "AMOUNT", value: 50_000, minimum: 400_000, maxUses: 200 },
    ],
  });

  // Une : produits visibles sur la photo (x/y en % du cadre), modifiables dans l'admin, module Contenu.
  const idOf = (name: string) => productIds[DEFS.findIndex((d) => d.name === name)]!;
  const heroHotspots = [
    { productId: idOf("Taie d'oreiller percale"), x: 26, y: 37 },
    { productId: idOf("Housse de couette lin lavé"), x: 48, y: 46 },
    { productId: idOf("Drap housse percale de coton"), x: 74, y: 62 },
  ];
  await prisma.contentBlock.createMany({
    data: [
      { slot: "home_hero", hotspots: heroHotspots, title: "Le lin, au naturel", subtitle: "Linge de maison lavé à la pierre et vêtements légers pour la saison chaude.", imageUrl: contentVisual("hero", () => demoImage(UPLOADS, "linen", COLORS["Écru"]!, 1, false)), linkUrl: "/c/linge-de-maison", linkLabel: "Découvrir le linge de maison", position: 0 },
      { slot: "home_collection", title: "L'essentiel de l'été", subtitle: "Chemises, robes et sandales pour les jours chauds.", imageUrl: contentVisual("summer", () => demoImage(UPLOADS, "dress", COLORS.Terre!, 0, false)), linkUrl: "/collections/essentiel-ete", linkLabel: "Voir la collection", position: 0 },
      { slot: "home_collection", title: "Tout en lin", subtitle: "De la chambre au dressing.", imageUrl: contentVisual("linen", () => demoImage(UPLOADS, "shirt", COLORS.Ciel!, 0, false)), linkUrl: "/collections/tout-en-lin", linkLabel: "Voir la collection", position: 1 },
    ],
  });

  // ---------------- Commandes historiques (tableau de bord)
  console.log("Commandes et avis…");
  const statuses = ["DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "PREPARING", "PAID", "PAID", "CANCELLED", "PENDING_PAYMENT"] as const;
  for (let i = 0; i < 70; i++) {
    const customer = i < 6 ? users.CUSTOMER! : pick(customers);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    const lines = Array.from({ length: int(1, 3) }, () => pick(variantPool));
    const items = lines.map((l) => ({ ...l, qty: int(1, 2) }));
    const subtotal = items.reduce((n, l) => n + l.price * l.qty, 0);
    const zone = pick(zones);
    const shipping = zone.isPickup || subtotal >= 1_000_000 ? 0 : zone.price;
    const createdAt = new Date(Date.now() - int(0, 44) * 86400_000 - int(0, 86400) * 1000);
    const status = i < 3 ? "DELIVERED" : pick([...statuses]);
    const method = pick(["cash_on_delivery", "test_card", "cash_on_delivery"]);
    const order = await prisma.order.create({
      data: {
        userId: u.id, email: u.email, status, subtotal, shippingTotal: shipping, total: subtotal + shipping, currency: "GNF",
        shippingAddress: { name: u.name, phone: "+224 620 00 00 00", line1: "Quartier Almamya", city: "Conakry", country: "Guinée" },
        shippingMethod: zone.name, shippingZoneId: zone.id, paymentMethod: method, createdAt,
        items: { create: items.map((l) => ({ variantId: l.id, name: l.name, sku: l.sku, attributes: l.attrs, unitPrice: l.price, quantity: l.qty })) },
        events: { create: [{ type: "status", message: "Commande créée", internal: false, createdAt }] },
      },
    });
    if (status !== "PENDING_PAYMENT" && status !== "CANCELLED") {
      await prisma.payment.create({ data: { orderId: order.id, provider: method, externalRef: `seed_${order.id}`, amount: order.total, status: method === "cash_on_delivery" && status !== "DELIVERED" ? "PENDING" : "SUCCEEDED", createdAt } });
    }
    if (status === "SHIPPED" || status === "DELIVERED") {
      await prisma.shipment.create({ data: { orderId: order.id, carrier: "Livreur Leppi", trackingNumber: `LP${order.number}`, shippedAt: new Date(createdAt.getTime() + 86400_000), deliveredAt: status === "DELIVERED" ? new Date(createdAt.getTime() + 2 * 86400_000) : null } });
    }
  }

  // Avis vérifiés : sur les produits réellement commandés et livrés.
  const delivered = await prisma.orderItem.findMany({ where: { order: { status: "DELIVERED" } }, include: { order: true, variant: true } });
  const texts = [
    [5, "Qualité remarquable, le tissu est encore plus beau en vrai. Je recommande."],
    [5, "Taille parfaitement, la matière est douce et épaisse. Livraison rapide à Conakry."],
    [4, "Très joli, un peu froissé à la réception mais c'est le charme du lin."],
    [4, "Belle finition, conforme aux photos. J'aurais aimé plus de coloris."],
    [3, "Correct, la couleur est un peu plus claire que prévu."],
  ] as const;
  const reviewed = new Set<string>();
  for (const item of delivered) {
    if (!item.variant || !item.order.userId) continue;
    const key = `${item.order.userId}:${item.variant.productId}`;
    if (reviewed.has(key) || rand() < 0.35) continue;
    reviewed.add(key);
    const [rating, text] = pick([...texts]);
    await prisma.review.create({ data: { userId: item.order.userId, productId: item.variant.productId, rating, text, status: rand() < 0.85 ? "APPROVED" : "PENDING" } });
  }

  const counts = {
    produits: await prisma.product.count(),
    variantes: await prisma.productVariant.count(),
    commandes: await prisma.order.count(),
    avis: await prisma.review.count(),
  };
  console.log("Terminé :", counts);

  // Le frontend garde le catalogue en cache : on le vide pour qu'il affiche les nouvelles données.
  await revalidateFrontend(["catalog", "categories", "home", "settings", ...pages.map(([slug]) => `page:${slug}`)], { immediate: true });
  console.log("Comptes de démo (mot de passe : Demo1234!) :", accounts.map(([e, , r]) => `${r} → ${e}`).join(" | "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
