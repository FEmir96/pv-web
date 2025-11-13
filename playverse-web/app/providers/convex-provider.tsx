// playverse-web/app/providers/convex-provider.tsx
"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import React from "react";

const address = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexReactClient(address);

export default function ConvexProviderClient({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
