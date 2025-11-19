// convex/queries/games/getIdByEmbedUrl.ts
import { query } from "../../_generated/server";
import { v } from "convex/values";

export const getIdByEmbedUrl = query({
  args: { embedUrl: v.string() },

  handler: async (ctx, { embedUrl }) => {
    if (!embedUrl) return null;

    const clean = embedUrl.trim().toLowerCase();

    // Leer TODOS los juegos (tu tabla es chica, es seguro)
    const allGames = await ctx.db.query("games").collect();

    // Normalizar y buscar coincidencias
    const match = allGames.find((g) => {
      const a = (g.embedUrl ?? g.embed_url ?? "").toLowerCase();
      return a === clean;
    });

    if (match) {
      return {
        id: match._id,
        title: match.title,
        embedUrl: match.embedUrl ?? match.embed_url,
      };
    }

    // Intento por coincidencia parcial /tetris, /arena, etc.
    const rel = allGames.find((g) => {
      const a = (g.embedUrl ?? g.embed_url ?? "").toLowerCase();
      return a.includes(clean);
    });

    if (rel) {
      return {
        id: rel._id,
        title: rel.title,
        embedUrl: rel.embedUrl ?? rel.embed_url,
      };
    }

    return null;
  },
});
