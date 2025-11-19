// src/lib/convexClient.ts
import { ConvexReactClient } from "convex/react";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  "https://utmost-crocodile-673.convex.cloud";

export const convex = new ConvexReactClient(convexUrl);
