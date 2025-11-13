// convex/mutations/savePaymentMethod.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const savePaymentMethod = mutation({
  args: {
    userId: v.id("profiles"),
    fullNumber: v.string(), // Número completo (solo para validar + hash)
    exp: v.string(),        // "MM/YY"
    cvv: v.string(),        // no se guarda
    brand: v.optional(
      v.union(
        v.literal("visa"),
        v.literal("mastercard"),
        v.literal("amex"),
        v.literal("otro")
      )
    ),
  },
  handler: async ({ db }, { userId, fullNumber, exp, cvv, brand }) => {
    // Normalizar PAN
    const pan = fullNumber.replace(/\s|-/g, "");
    if (!/^\d{12,19}$/.test(pan)) {
      throw new Error("Número inválido");
    }

    // Detectar marca si no llega (heurística simple)
    const detected =
      brand ??
      (pan.startsWith("4")
        ? "visa"
        : /^5[1-5]/.test(pan)
        ? "mastercard"
        : /^3[47]/.test(pan)
        ? "amex"
        : "otro");

    // Parse vencimiento "MM/YY"
    const m = exp.match(/^(\d{1,2})\/(\d{2})$/);
    if (!m) throw new Error("Vencimiento inválido (MM/YY)");
    const expMonth = Number(m[1]);
    const expYear = 2000 + Number(m[2]);
    if (expMonth < 1 || expMonth > 12) throw new Error("Mes inválido");

    // (Opcional) Rechazar tarjetas obviamente vencidas (fin de mes)
    const endOfMonth = new Date(expYear, expMonth, 0, 23, 59, 59, 999).getTime();
    if (endOfMonth < Date.now()) throw new Error("La tarjeta está vencida");

    const last4 = pan.slice(-4);

    // Hash SHA-256 del PAN con Web Crypto (runtime isolate)
    const panHash = await sha256Hex(pan);

    await db.insert("paymentMethods", {
      userId,
      brand: detected,
      last4,
      expMonth,
      expYear,
      panHash,        // solo hash, nunca guardamos el PAN real
      createdAt: Date.now(),
    });

    return { ok: true } as const;
  },
});

// --- helpers ---

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await (globalThis as any).crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
