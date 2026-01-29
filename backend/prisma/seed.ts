import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Créer l'utilisateur admin par défaut
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.users.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      nom: "Administrateur",
      prenom: "DH Immobilier",
      email: "admin@dhimmobilier.com",
      role: "admin",
      username: "admin",
      password_hash: adminPassword,
      actif: true,
    },
  });
  console.log("✅ Admin user created:", admin.username);

  // Créer un comptable
  const comptablePassword = await bcrypt.hash("comptable123", 10);
  const comptable = await prisma.users.upsert({
    where: { username: "comptable" },
    update: {},
    create: {
      nom: "Comptable",
      prenom: "DH",
      email: "comptable@dhimmobilier.com",
      role: "comptable",
      username: "comptable",
      password_hash: comptablePassword,
      actif: true,
    },
  });
  console.log("✅ Comptable user created:", comptable.username);

  // Créer une secrétaire
  const secretairePassword = await bcrypt.hash("secretaire123", 10);
  const secretaire = await prisma.users.upsert({
    where: { username: "secretaire" },
    update: {},
    create: {
      nom: "Secrétaire",
      prenom: "DH",
      email: "secretaire@dhimmobilier.com",
      role: "secretaire",
      username: "secretaire",
      password_hash: secretairePassword,
      actif: true,
    },
  });
  console.log("✅ Secrétaire user created:", secretaire.username);

  // Créer les types de propriétés
  const typesProprietesData = [
    { nom: "Studio", description: "Logement d'une pièce principale" },
    { nom: "Appartement F2", description: "Logement de 2 pièces principales" },
    { nom: "Appartement F3", description: "Logement de 3 pièces principales" },
    { nom: "Appartement F4", description: "Logement de 4 pièces principales" },
    { nom: "Villa", description: "Maison individuelle avec jardin" },
    { nom: "Duplex", description: "Logement sur deux niveaux" },
    { nom: "Commerce", description: "Local commercial" },
    { nom: "Bureau", description: "Espace de bureau" },
    { nom: "Maison", description: "Maison individuelle" },
    { nom: "Appartement", description: "Logement dans un immeuble" },
    { nom: "Magasin", description: "Local commercial pour vente au détail" },
  ];

  for (const type of typesProprietesData) {
    await prisma.types_proprietes.upsert({
      where: { nom: type.nom },
      update: {},
      create: type,
    });
  }
  console.log("✅ Types de propriétés créés");

  // Créer le barème des droits de terre
  const baremeDroitsTerreData = [
    { type_bien: "Atelier", montant_mensuel: 10000, description: "Atelier - 10 000 FCFA/mois" },
    { type_bien: "Chambre salon", montant_mensuel: 15000, description: "Chambre salon - 15 000 FCFA/mois" },
    { type_bien: "2 chambres salon", montant_mensuel: 30000, description: "2 chambres salon - 30 000 FCFA/mois" },
    { type_bien: "3 chambres salon", montant_mensuel: 45000, description: "3 chambres salon - 45 000 FCFA/mois" },
    { type_bien: "Magasin (petit)", montant_mensuel: 10000, description: "Magasin petit - 10 000 FCFA/mois" },
    { type_bien: "Magasin (grand)", montant_mensuel: 20000, description: "Magasin grand - 20 000 FCFA/mois" },
  ];

  for (const bareme of baremeDroitsTerreData) {
    await prisma.bareme_droits_terre.upsert({
      where: { type_bien: bareme.type_bien },
      update: {},
      create: bareme,
    });
  }
  console.log("✅ Barème des droits de terre créé");

  // Créer le solde initial de la caisse
  const existingBalance = await prisma.caisse_balance.findFirst();
  if (!existingBalance) {
    await prisma.caisse_balance.create({
      data: {
        solde_courant: 0,
        balance: 0,
      },
    });
    console.log("✅ Solde initial de la caisse créé");
  }

  // Créer le compteur de reçus
  const existingCounter = await prisma.receipt_counters.findFirst();
  if (!existingCounter) {
    await prisma.receipt_counters.create({
      data: {
        type: "general",
        compteur: 0,
      },
    });
    console.log("✅ Compteur de reçus créé");
  }

  console.log("🎉 Seeding completed!");
  console.log("\n📋 Comptes créés:");
  console.log("   - admin / admin123 (Administrateur)");
  console.log("   - comptable / comptable123 (Comptable)");
  console.log("   - secretaire / secretaire123 (Secrétaire)");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
