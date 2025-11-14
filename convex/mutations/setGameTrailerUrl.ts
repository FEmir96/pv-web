import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Permite YouTube y Vimeo (agregá otros si querés)
const YT_WATCH = /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([\w-]{11})/i;
const YT_SHORT = /^https?:\/\/(youtu\.be)\/([\w-]{11})/i;
const VIMEO = /^https?:\/\/(www\.)?vimeo\.com\/(\d+)/i;

function toEmbed(url: string, lang: string = "es-419"): string {
  let m;
  if ((m = url.match(YT_WATCH)) || (m = url.match(YT_SHORT))) {
    const id = m[2];
    // Player “privacidad mejorada”
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&hl=${encodeURIComponent(lang)}`;
  }
  if ((m = url.match(VIMEO))) {
    const id = m[2];
    return `https://player.vimeo.com/video/${id}`;
  }
  throw new Error("Proveedor de video no permitido");
}

export const setGameTrailerUrl = mutation({
  args: {
    gameId: v.id("games"),
    url: v.string(),         // pega acá el link de YouTube/Vimeo
    lang: v.optional(v.string()), // ej. "es-419"
  },
  handler: async (ctx, { gameId, url, lang }) => {
    const embed = toEmbed(url, lang ?? "es-419");
    await ctx.db.patch(gameId, { trailer_url: embed });
    return { ok: true, trailer_url: embed };
  },
});
