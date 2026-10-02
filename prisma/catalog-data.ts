/**
 * Catalogue de démonstration : partagé par le seed et par fetch-demo-photos.
 */
import type { ProductFamily } from "../src/generated/prisma/client";
import type { demoImage } from "./demo-images";

export const COLORS: Record<string, string> = {
  Blanc: "#F5F2EC",
  Écru: "#EDE6D8",
  Sable: "#D8C7A8",
  Terre: "#A0673F",
  Olive: "#6B6B45",
  Sauge: "#9CAF94",
  Marine: "#1F2A3C",
  Ciel: "#A9BFD4",
  Anthracite: "#3D3B38",
  Noir: "#1C1A17",
  Bordeaux: "#6D2B33",
  "Rose poudré": "#E3C4BE",
};

export type Def = {
  name: string;
  family: ProductFamily;
  cat: string;
  shape: Parameters<typeof demoImage>[1];
  price: number;
  compareAt?: number;
  colors: string[];
  material: string;
  details: Record<string, string>;
  description: string;
};

export const LINEN_CARE = "Lavage 60 °C, séchage en tambour à basse température, repassage à température moyenne.";
export const CLOTH_CARE = "Lavage 30 °C sur l'envers, ne pas sécher en tambour, repassage doux.";
export const SHOE_CARE = "Brosser à sec, nourrir le cuir avec une crème incolore, stocker à l'abri de la lumière.";

export const DEFS: Def[] = [
  // Linge de maison — 11
  { name: "Drap housse percale de coton", family: "LINEN", cat: "draps", shape: "linen", price: 450_000, colors: ["Blanc", "Sable", "Sauge"], material: "Coton", details: { Grammage: "120 g/m²", "Fils/cm²": "80", Tissage: "Percale" }, description: "Percale de coton peigné, tissage serré pour un toucher frais et mat. Bonnet de 30 cm, élastique sur tout le tour." },
  { name: "Drap plat lin lavé", family: "LINEN", cat: "draps", shape: "linen", price: 690_000, colors: ["Écru", "Terre", "Anthracite"], material: "Lin", details: { Grammage: "165 g/m²", Finition: "Lavé à la pierre" }, description: "Lin européen lavé à la pierre : souple dès le premier usage, il gagne en douceur à chaque lavage." },
  { name: "Drap housse satin de coton", family: "LINEN", cat: "draps", shape: "linen", price: 520_000, compareAt: 650_000, colors: ["Blanc", "Marine"], material: "Coton", details: { Grammage: "130 g/m²", "Fils/cm²": "100", Tissage: "Satin" }, description: "Satin de coton au tomber fluide et à l'éclat discret, pour un lit soyeux toute l'année." },
  { name: "Housse de couette percale", family: "LINEN", cat: "housses-de-couette", shape: "linen", price: 820_000, colors: ["Blanc", "Ciel", "Sable"], material: "Coton", details: { Grammage: "120 g/m²", "Fils/cm²": "80", Fermeture: "Boutons nacrés" }, description: "Housse de couette en percale, fermeture par boutons, rabat intérieur pour maintenir la couette." },
  { name: "Housse de couette lin lavé", family: "LINEN", cat: "housses-de-couette", shape: "linen", price: 1_150_000, colors: ["Écru", "Olive", "Rose poudré"], material: "Lin", details: { Grammage: "165 g/m²", Fermeture: "Liens" }, description: "Lin lavé au rendu naturellement froissé, pour une chambre décontractée et respirante." },
  { name: "Housse de couette gaze de coton", family: "LINEN", cat: "housses-de-couette", shape: "linen", price: 780_000, colors: ["Blanc", "Sauge"], material: "Coton", details: { Grammage: "140 g/m²", Tissage: "Double gaze" }, description: "Double gaze de coton légère et gonflante, idéale pour les nuits chaudes." },
  { name: "Housse de couette satin rayé", family: "LINEN", cat: "housses-de-couette", shape: "linen", price: 890_000, compareAt: 1_050_000, colors: ["Blanc", "Anthracite"], material: "Coton", details: { Grammage: "130 g/m²", Motif: "Rayure tissée 5 mm" }, description: "Satin de coton à fines rayures tissées ton sur ton, esprit hôtel." },
  { name: "Taie d'oreiller percale", family: "LINEN", cat: "taies", shape: "pillow", price: 120_000, colors: ["Blanc", "Sable", "Sauge", "Ciel"], material: "Coton", details: { Grammage: "120 g/m²", "Fils/cm²": "80" }, description: "Taie en percale avec rabat, assortie à nos draps et housses." },
  { name: "Taie d'oreiller lin lavé", family: "LINEN", cat: "taies", shape: "pillow", price: 180_000, colors: ["Écru", "Terre", "Olive"], material: "Lin", details: { Grammage: "165 g/m²" }, description: "Lin lavé, fermeture à liens, pour une touche naturelle." },
  { name: "Taie volantée gaze de coton", family: "LINEN", cat: "taies", shape: "pillow", price: 160_000, colors: ["Blanc", "Rose poudré"], material: "Coton", details: { Grammage: "140 g/m²", Finition: "Volant 3 cm" }, description: "Double gaze et petit volant plat pour une chambre douce." },
  { name: "Drap plat percale bourdon", family: "LINEN", cat: "draps", shape: "linen", price: 490_000, colors: ["Blanc", "Écru"], material: "Coton", details: { Grammage: "120 g/m²", Finition: "Point bourdon" }, description: "Percale de coton ornée d'un point bourdon brodé en tête de drap." },

  // Vêtements — 11
  { name: "Chemise en lin lavé", family: "CLOTHING", cat: "chemises", shape: "shirt", price: 390_000, compareAt: 520_000, colors: ["Écru", "Ciel", "Olive"], material: "Lin", details: { Coupe: "Droite", "Mannequin": "1,85 m, porte un M" }, description: "Chemise ample en lin lavé, col classique, patte boutonnée. Légère et respirante." },
  { name: "Chemise popeline col officier", family: "CLOTHING", cat: "chemises", shape: "shirt", price: 350_000, colors: ["Blanc", "Marine"], material: "Coton", details: { Coupe: "Ajustée", "Mannequin": "1,83 m, porte un M" }, description: "Popeline de coton au toucher net, col officier minimaliste." },
  { name: "Surchemise en sergé", family: "CLOTHING", cat: "chemises", shape: "shirt", price: 520_000, colors: ["Terre", "Anthracite"], material: "Coton", details: { Coupe: "Oversize", "Mannequin": "1,85 m, porte un L" }, description: "Sergé de coton épais, deux poches plaquées, à porter ouverte comme une veste légère." },
  { name: "Chemise rayée coton bio", family: "CLOTHING", cat: "chemises", shape: "shirt", price: 360_000, colors: ["Ciel", "Blanc"], material: "Coton bio", details: { Coupe: "Droite", "Mannequin": "1,80 m, porte un S" }, description: "Rayure fine sur coton biologique, pour tous les jours." },
  { name: "Robe chemise en lin", family: "CLOTHING", cat: "robes", shape: "dress", price: 590_000, colors: ["Écru", "Terre", "Noir"], material: "Lin", details: { Coupe: "Évasée", Longueur: "Mi-mollet", "Mannequin": "1,76 m, porte un S" }, description: "Robe chemise ceinturée en lin lavé, manches retroussables." },
  { name: "Robe portefeuille viscose", family: "CLOTHING", cat: "robes", shape: "dress", price: 540_000, compareAt: 690_000, colors: ["Bordeaux", "Olive"], material: "Viscose", details: { Coupe: "Portefeuille", Longueur: "Midi", "Mannequin": "1,75 m, porte un S" }, description: "Viscose fluide, décolleté cache-cœur et lien à nouer." },
  { name: "Robe droite en popeline", family: "CLOTHING", cat: "robes", shape: "dress", price: 480_000, colors: ["Blanc", "Marine"], material: "Coton", details: { Coupe: "Droite", Longueur: "Genou", "Mannequin": "1,77 m, porte un S" }, description: "Robe droite sans manches en popeline structurée." },
  { name: "Pantalon large en lin", family: "CLOTHING", cat: "pantalons", shape: "pants", price: 450_000, colors: ["Sable", "Noir", "Olive"], material: "Lin", details: { Coupe: "Large", Taille: "Élastiquée", "Mannequin": "1,76 m, porte un S" }, description: "Pantalon ample à taille élastiquée, jambe large et fluide." },
  { name: "Chino coton stretch", family: "CLOTHING", cat: "pantalons", shape: "pants", price: 420_000, colors: ["Sable", "Marine", "Anthracite"], material: "Coton", details: { Coupe: "Fuselée", "Mannequin": "1,84 m, porte un M" }, description: "Chino en sergé de coton légèrement stretch, coupe fuselée." },
  { name: "Pantalon à pinces en laine froide", family: "CLOTHING", cat: "pantalons", shape: "pants", price: 690_000, colors: ["Anthracite", "Terre"], material: "Laine", details: { Coupe: "Droite à pinces", "Mannequin": "1,85 m, porte un M" }, description: "Laine froide légère, double pince, tombé impeccable." },
  { name: "Jupe-culotte en lin", family: "CLOTHING", cat: "pantalons", shape: "pants", price: 380_000, colors: ["Écru", "Terre"], material: "Lin", details: { Coupe: "Large", Longueur: "Mi-mollet", "Mannequin": "1,74 m, porte un S" }, description: "Jupe-culotte fluide en lin, poches côté." },

  // T-shirts — 11
  { name: "T-shirt coton bio 220 g/m²", family: "TSHIRT", cat: "basiques", shape: "tshirt", price: 150_000, colors: ["Blanc", "Noir", "Écru", "Marine"], material: "Coton bio", details: { Grammage: "220 g/m²", Col: "Rond", Coupe: "Droite" }, description: "Jersey épais en coton biologique, col côtelé qui garde sa forme." },
  { name: "T-shirt col V coton pima", family: "TSHIRT", cat: "basiques", shape: "tshirt", price: 170_000, colors: ["Blanc", "Anthracite"], material: "Coton pima", details: { Grammage: "160 g/m²", Col: "V", Coupe: "Ajustée" }, description: "Coton pima à fibres longues, doux et légèrement brillant." },
  { name: "T-shirt oversize heavy", family: "TSHIRT", cat: "basiques", shape: "tshirt", price: 190_000, colors: ["Sable", "Olive", "Noir"], material: "Coton", details: { Grammage: "260 g/m²", Col: "Rond", Coupe: "Oversize" }, description: "Coupe ample et épaules tombantes, jersey lourd au tomber structuré." },
  { name: "T-shirt manches longues", family: "TSHIRT", cat: "basiques", shape: "tshirt", price: 180_000, colors: ["Écru", "Marine"], material: "Coton bio", details: { Grammage: "200 g/m²", Col: "Rond", Coupe: "Droite" }, description: "Manches longues en jersey de coton bio, poignets côtelés." },
  { name: "T-shirt lin et coton", family: "TSHIRT", cat: "basiques", shape: "tshirt", price: 210_000, colors: ["Écru", "Sauge", "Terre"], material: "Lin", details: { Grammage: "180 g/m²", Col: "Rond", Coupe: "Droite" }, description: "Jersey flammé lin et coton, frais et texturé." },
  { name: "Débardeur côtelé", family: "TSHIRT", cat: "basiques", shape: "tshirt", price: 110_000, colors: ["Blanc", "Noir"], material: "Coton", details: { Grammage: "190 g/m²", Col: "Rond", Coupe: "Ajustée" }, description: "Maille côtelée stretch, à porter seul ou en sous-couche." },
  { name: "T-shirt imprimé Palmeraie", family: "TSHIRT", cat: "imprimes", shape: "tshirt", price: 175_000, colors: ["Écru", "Sable"], material: "Coton bio", details: { Grammage: "220 g/m²", Col: "Rond", Impression: "Sérigraphie à l'eau" }, description: "Illustration botanique sérigraphiée à l'eau, encres sans solvant." },
  { name: "T-shirt imprimé Conakry", family: "TSHIRT", cat: "imprimes", shape: "tshirt", price: 175_000, compareAt: 210_000, colors: ["Blanc", "Marine"], material: "Coton bio", details: { Grammage: "220 g/m²", Col: "Rond", Impression: "Sérigraphie" }, description: "Typographie éditoriale en hommage à la ville, sérigraphie deux couleurs." },
  { name: "T-shirt brodé poitrine", family: "TSHIRT", cat: "imprimes", shape: "tshirt", price: 195_000, colors: ["Blanc", "Écru", "Olive"], material: "Coton", details: { Grammage: "220 g/m²", Col: "Rond", Finition: "Broderie ton sur ton" }, description: "Petite broderie ton sur ton sur la poitrine." },
  { name: "T-shirt rayé marin", family: "TSHIRT", cat: "imprimes", shape: "tshirt", price: 185_000, colors: ["Marine", "Bordeaux"], material: "Coton", details: { Grammage: "200 g/m²", Col: "Bateau", Motif: "Rayure tissée" }, description: "Rayure tissée façon marinière, col bateau." },
  { name: "T-shirt imprimé Atelier", family: "TSHIRT", cat: "imprimes", shape: "tshirt", price: 165_000, colors: ["Anthracite", "Sable"], material: "Coton bio", details: { Grammage: "220 g/m²", Col: "Rond", Impression: "Sérigraphie" }, description: "Motif graphique d'atelier imprimé dans le dos." },

  // Chaussures — 11
  { name: "Basket cuir pleine fleur", family: "SHOES", cat: "baskets", shape: "sneaker", price: 890_000, colors: ["Blanc", "Noir"], material: "Cuir", details: { Dessus: "Cuir pleine fleur", Semelle: "Caoutchouc naturel cousue", Largeur: "Normale" }, description: "Basket minimaliste en cuir pleine fleur, semelle cousue Margom." },
  { name: "Basket toile bio", family: "SHOES", cat: "baskets", shape: "sneaker", price: 450_000, colors: ["Écru", "Marine", "Olive"], material: "Coton bio", details: { Dessus: "Toile de coton bio", Semelle: "Caoutchouc vulcanisé", Largeur: "Normale" }, description: "Toile épaisse de coton bio et semelle vulcanisée." },
  { name: "Basket running daim", family: "SHOES", cat: "baskets", shape: "sneaker", price: 790_000, compareAt: 950_000, colors: ["Sable", "Anthracite"], material: "Daim", details: { Dessus: "Daim et nylon recyclé", Semelle: "EVA et caoutchouc", Largeur: "Normale" }, description: "Silhouette rétro running, daim et nylon recyclé." },
  { name: "Basket montante cuir", family: "SHOES", cat: "baskets", shape: "sneaker", price: 950_000, colors: ["Blanc", "Terre"], material: "Cuir", details: { Dessus: "Cuir grainé", Semelle: "Caoutchouc", Largeur: "Normale" }, description: "Tige montante en cuir grainé, doublure cuir." },
  { name: "Sandale à brides cuir", family: "SHOES", cat: "sandales", shape: "sandal", price: 520_000, colors: ["Terre", "Noir", "Sable"], material: "Cuir", details: { Dessus: "Cuir tanné végétal", Semelle: "Cuir et gomme", Largeur: "Normale" }, description: "Deux brides croisées en cuir tanné végétal, semelle anatomique." },
  { name: "Mule cuir tressé", family: "SHOES", cat: "sandales", shape: "sandal", price: 580_000, colors: ["Sable", "Noir"], material: "Cuir", details: { Dessus: "Cuir tressé main", Semelle: "Gomme", Largeur: "Large" }, description: "Mule en cuir tressé à la main, confortable dès le premier port." },
  { name: "Sandale plate minimaliste", family: "SHOES", cat: "sandales", shape: "sandal", price: 390_000, colors: ["Noir", "Écru"], material: "Cuir", details: { Dessus: "Cuir lisse", Semelle: "Gomme fine", Largeur: "Normale" }, description: "Fine bride et semelle plate, la sandale de tous les jours." },
  { name: "Derby cuir lisse", family: "SHOES", cat: "chaussures-de-ville", shape: "derby", price: 1_150_000, colors: ["Noir", "Terre"], material: "Cuir", details: { Dessus: "Veau lisse", Semelle: "Cuir et patin gomme", Largeur: "Normale" }, description: "Derby en veau lisse, montage Blake, semelle cuir avec patin." },
  { name: "Mocassin daim", family: "SHOES", cat: "chaussures-de-ville", shape: "derby", price: 980_000, colors: ["Sable", "Marine"], material: "Daim", details: { Dessus: "Daim velours", Semelle: "Gomme picots", Largeur: "Normale" }, description: "Mocassin souple en daim, semelle à picots." },
  { name: "Richelieu bout droit", family: "SHOES", cat: "chaussures-de-ville", shape: "derby", price: 1_290_000, colors: ["Noir", "Bordeaux"], material: "Cuir", details: { Dessus: "Veau box", Semelle: "Cuir cousue Goodyear", Largeur: "Normale" }, description: "Richelieu classique cousu Goodyear, ressemelable." },
  { name: "Bottine chelsea cuir", family: "SHOES", cat: "chaussures-de-ville", shape: "derby", price: 1_190_000, compareAt: 1_390_000, colors: ["Noir", "Terre"], material: "Cuir", details: { Dessus: "Cuir pleine fleur", Semelle: "Gomme crantée", Largeur: "Normale" }, description: "Chelsea boot à élastiques latéraux, semelle crantée." },
  // Couvre-matelas — 3 (ajoutés en fin de liste pour ne pas décaler les index du seed)
  { name: "Couvre-matelas matelassé coton", family: "LINEN", cat: "couvre-matelas", shape: "linen", price: 380_000, colors: ["Blanc"], material: "Coton", details: { Garnissage: "Ouate 200 g/m²", Bonnet: "30 cm", Finition: "Matelassé losange" }, description: "Couvre-matelas matelassé en coton : protège le matelas et ajoute une fine couche de confort. Bonnet élastiqué de 30 cm, lavable à 60 °C." },
  { name: "Protège-matelas imperméable", family: "LINEN", cat: "couvre-matelas", shape: "linen", price: 290_000, compareAt: 350_000, colors: ["Blanc"], material: "Coton", details: { Dessus: "Molleton de coton", Membrane: "Imperméable et respirante", Bonnet: "35 cm" }, description: "Molleton de coton doublé d'une membrane imperméable et respirante, silencieuse. Protège des liquides et des acariens." },
  { name: "Couvre-matelas lin lavé", family: "LINEN", cat: "couvre-matelas", shape: "linen", price: 520_000, colors: ["Écru"], material: "Lin", details: { Grammage: "165 g/m²", Finition: "Lavé à la pierre", Bonnet: "30 cm" }, description: "Lin lavé à la pierre, frais l'été et thermorégulateur : la touche naturelle sous vos draps. Bonnet élastiqué de 30 cm." },
];

export const SIZE_VALUES = ["XS", "S", "M", "L", "XL", "XXL"];
export const SHOE_VALUES = Array.from({ length: 11 }, (_, i) => String(36 + i));
export const DIM_VALUES = ["90×190", "140×190", "160×200", "180×200"];
export const PILLOW_VALUES = ["50×70", "65×65"];
