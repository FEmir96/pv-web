import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

// Crear el mensaje
export const createMessage = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    // opcionales: **undefined** si no están
    profileId: v.optional(v.id("profiles")),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"contactMessages">> => {
    const id = await ctx.db.insert("contactMessages", {
      name: args.name,
      email: args.email,
      subject: args.subject,
      message: args.message,
      ...(args.profileId ? { profileId: args.profileId } : {}),
      ...(args.userAgent ? { userAgent: args.userAgent } : {}),
      status: "new",
      createdAt: args.createdAt,
    });
    return id;
  },
});

// Actualizar estado
export const updateStatus = mutation({
  args: {
    id: v.id("contactMessages"),
    status: v.union(
      v.literal("new"),
      v.literal("sent"),
      v.literal("queued"),
      v.literal("read"),
      v.literal("closed")
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});
