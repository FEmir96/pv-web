// convex/functions/queries/getAdmins.ts
import { query } from "../_generated/server";

export const getAdmins = query({
  handler: async ({ db }) => {
    return await db
      .query("profiles")
      .filter(q => q.eq(q.field("role"), "admin"))
      .collect();
  },
});
