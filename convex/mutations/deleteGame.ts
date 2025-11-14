// convex/mutations/deleteGame.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { deleteGameCore } from "../lib/gameCore";

export const deleteGame = mutation({
  args: {
    gameId: v.id("games"),
    requesterId: v.optional(v.id("profiles")),
  },
  handler: async ({ db }, args) => {
    const res = await deleteGameCore(db, args);
    return res;
  },
});
