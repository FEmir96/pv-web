// src/lib/convexClient.ts
import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "❌ No está definida la variable NEXT_PUBLIC_CONVEX_URL en .env.local"
  );
}

export const convex = new ConvexReactClient(convexUrl);
