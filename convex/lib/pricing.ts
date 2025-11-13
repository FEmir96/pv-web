// convex/lib/pricing.ts
import type { Doc } from "../_generated/dataModel";

const PREMIUM_DISCOUNT_RATE = normalizeRate(
  process.env.PREMIUM_DISCOUNT
    ? Number(process.env.PREMIUM_DISCOUNT)
    : 0.1
);

function normalizeRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 0.9);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type PricingBreakdown = {
  basePrice: number;
  discountRate: number;
  discountAmount: number;
  finalPrice: number;
};

export function getDiscountRateForUser(user?: Doc<"profiles"> | null): number {
  if (!user) return 0;
  const role = (user as any)?.role;
  if (role !== "premium") return 0;
  return PREMIUM_DISCOUNT_RATE;
}

export function computePricing(basePrice: number, discountRate: number): PricingBreakdown {
  const safeBase = roundCurrency(Number.isFinite(basePrice) ? basePrice : 0);
  const rate = normalizeRate(discountRate);
  const discountAmount = rate > 0 ? roundCurrency(safeBase * rate) : 0;
  const finalPrice = roundCurrency(safeBase - discountAmount);
  return {
    basePrice: safeBase,
    discountRate: rate,
    discountAmount,
    finalPrice,
  };
}

export function combinePricing(
  current: Partial<PricingBreakdown> | null | undefined,
  delta: PricingBreakdown
): PricingBreakdown {
  return {
    basePrice: roundCurrency((current?.basePrice ?? 0) + delta.basePrice),
    discountRate:
      delta.discountRate ||
      current?.discountRate ||
      0,
    discountAmount: roundCurrency(
      (current?.discountAmount ?? 0) + delta.discountAmount
    ),
    finalPrice: roundCurrency(
      (current?.finalPrice ?? 0) + delta.finalPrice
    ),
  };
}
