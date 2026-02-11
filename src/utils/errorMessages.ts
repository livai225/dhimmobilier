export function getInsufficientFundsMessage(error: unknown): string | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (!message) return null;

  const normalized = message.toLowerCase();
  if (normalized.includes("montant insuffisant") || normalized.includes("solde insuffisant")) {
    return message;
  }
  if (normalized.includes("caisse versement") && normalized.includes("insuffisant")) {
    return message;
  }

  return null;
}
