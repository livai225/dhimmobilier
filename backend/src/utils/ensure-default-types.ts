import { prisma } from "../lib/prisma.js";

const DEFAULT_TYPES = ["STUDIO", "MAGASIN", "2 PIECES", "3 PIECES", "4 PIECES"];

export async function ensureDefaultTypesProprietes() {
  const existing = await prisma.types_proprietes.findMany({
    where: { nom: { in: DEFAULT_TYPES } },
    select: { nom: true },
  });

  const existingSet = new Set(existing.map((t) => t.nom));
  const missing = DEFAULT_TYPES.filter((name) => !existingSet.has(name));

  if (missing.length === 0) return;

  await prisma.types_proprietes.createMany({
    data: missing.map((name) => ({ nom: name, description: null })),
    skipDuplicates: true,
  });
}
