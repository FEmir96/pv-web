// convex/queries/getPaymentMethods.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

const TABLE = "paymentMethods" as const;

type Brand = "visa" | "mastercard" | "amex" | "otro";
const normBrand = (b?: string): Brand => {
  const s = (b || "").toLowerCase();
  if (s.includes("visa")) return "visa";
  if (s.includes("master")) return "mastercard";
  if (s.includes("amex") || s.includes("american")) return "amex";
  return "otro";
};

export const getPaymentMethods = query({
  // opcional para poder hacer skip en el primer render
  args: { userId: v.optional(v.id("profiles")) },
  handler: async (ctx, { userId }) => {
    if (!userId) return [];

    // No asumimos índices: filtramos por userId
    const rows = await (ctx.db as any)
      .query(TABLE)
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();

    // Orden: primero "primary" si existiera, luego más nuevo
    rows.sort(
      (a: any, b: any) =>
        Number(!!b.primary) - Number(!!a.primary) ||
        (b.createdAt ?? b._creationTime ?? 0) -
          (a.createdAt ?? a._creationTime ?? 0)
    );

    // Mapeo compatible con tus UIs:
    // - checkout espera `_id`
    // - profile usa `id` como key → devolvemos ambos
    return rows.map((r: any) => ({
      _id: r._id,
      id: r._id,
      brand: normBrand(r.brand),
      last4: String(r.last4 ?? "").slice(-4),
      expMonth: Number(r.expMonth ?? 0),
      expYear: Number(r.expYear ?? 0),
    }));
  },
});
