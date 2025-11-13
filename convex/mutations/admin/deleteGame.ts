// convex/mutations/admin/deleteGame.ts
import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { deleteGameCore } from "../../lib/gameCore";

export const deleteGame = mutation({
  args: {
    id: v.id("games"),
    requesterId: v.optional(v.id("profiles")),
  },
  handler: async ({ db }, { id, requesterId }) => {
    const res = await deleteGameCore(db, { gameId: id, requesterId });
    return res;
  },
});
