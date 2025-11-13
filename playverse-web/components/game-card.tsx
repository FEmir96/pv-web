// playverse-web/components/game-card.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Heart } from "lucide-react";
import type { Doc, Id } from "@convex/_generated/dataModel";

import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useToast } from "@/hooks/use-toast";

/* ⬇️ store del header (solo para mantener la UI en sync, no como verdad) */
import { useFavoritesStore } from "@/components/favoritesStore";

type UserRole = "free" | "premium" | "admin";

type Props = {
  game: Doc<"games">;
  userRole?: UserRole;
  currency?: string; // default "USD"
};

/* ---------------- helpers ---------------- */
function getUserStars(g: any): number | null {
  const a = typeof g?.igdbUserRating === "number" ? g.igdbUserRating : undefined;
  const b = typeof g?.igdbRating === "number" ? g.igdbRating : undefined;
  const c = typeof g?.popscore === "number" ? g.popscore : undefined;
  const s100 = a ?? b ?? c;
  if (typeof s100 !== "number") return null;
  const stars = Math.round((s100 / 20) * 10) / 10;
  return stars > 0 ? stars : null;
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

function pickRentPrice(game: any): number | undefined {
  return (
    num(game?.weeklyPrice) ??
    num(game?.monthlyPrice) ??
    num(game?.rentPrice) ??
    num(game?.prices?.rentWeekly) ??
    num(game?.pricing?.rent)
  );
}
function pickBuyPrice(game: any): number | undefined {
  return (
    num(game?.purchasePrice) ??
    num(game?.prices?.buy) ??
    num(game?.pricing?.purchase) ??
    num(game?.price)
  );
}

function formatCurrency(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

/* ---------------- component ---------------- */
export default function GameCard({
  game,
  userRole = "free",
  currency = "USD",
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const href = `/juego/${game._id}`;
  const primaryGenre =
    (Array.isArray((game as any).genres) && (game as any).genres[0]) || "General";
  const isPremiumPlan = (game as any).plan === "premium";

  // ====== sesión y perfil
  const { data: session, status } = useSession();
  const email = session?.user?.email?.toLowerCase() ?? null;
  const isLogged = status === "authenticated" && !!email;

  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    email ? { email } : "skip"
  ) as (Doc<"profiles"> & { role?: UserRole }) | null | undefined;

  // Rol efectivo: si hay perfil lo usamos; si no, el prop (fallback)
  const effectiveRole: UserRole = (profile?.role as UserRole | undefined) ?? userRole;
  const isPremiumUser = effectiveRole === "premium" || effectiveRole === "admin";

  const userStars = getUserStars(game);

  // precios + -10% (premium/admin)
  const rent = pickRentPrice(game);
  const buy = pickBuyPrice(game);
  const rentSuffix =
    typeof (game as any).weeklyPrice === "number"
      ? "/sem"
      : typeof (game as any).monthlyPrice === "number"
      ? "/mes"
      : "";

  const showRentDiscount = isPremiumUser && typeof rent === "number" && rent > 0;
  const showBuyDiscount = isPremiumUser && typeof buy === "number" && buy > 0;
  const rentFinal = showRentDiscount ? +(rent! * 0.9).toFixed(2) : rent;
  const buyFinal = showBuyDiscount ? +(buy! * 0.9).toFixed(2) : buy;

  // imagen + relleno sin huecos
  const coverUrl = (game as any).cover_url || "/placeholder_game.jpg";
  const ASPECT = "aspect-[5/7]";

  /* ===== Favoritos: server + UI sync ===== */
  const addFav = useFavoritesStore((s) => s.add);
  const removeFav = useFavoritesStore((s) => s.remove);
  const favItems = useFavoritesStore((s) => s.items);

  const favoritesEnabled =
    process.env.NEXT_PUBLIC_USE_SERVER_FAVORITES === "1" &&
    Boolean((api as any).queries?.listFavoritesByUser?.listFavoritesByUser) &&
    Boolean(profile?._id);

  const serverList = useQuery(
    (favoritesEnabled
      ? (api as any).queries.listFavoritesByUser.listFavoritesByUser
      : (api as any).queries.getGameById.getGameById) as any,
    favoritesEnabled ? ({ userId: (profile as any)._id } as any) : "skip"
  ) as Array<{ game?: { _id?: Id<"games"> }; gameId?: Id<"games"> }> | undefined;

  const isFavServer = useMemo(() => {
    if (!serverList || !game?._id) return undefined;
    const gid = String(game._id);
    return serverList.some((f) => String(f?.game?._id ?? f?.gameId ?? "") === gid);
  }, [serverList, game?._id]);

  const isFavLocal = useMemo(
    () => favItems.some((i) => i.id === String(game._id)),
    [favItems, game._id]
  );

  const isFav = typeof isFavServer === "boolean" ? isFavServer : isFavLocal;

  const toggleFavoriteMutation = useMutation(
    api.mutations.toggleFavorite.toggleFavorite as any
  );

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!game?._id) return;

    if (!isLogged || !profile?._id) {
      router.push(`/auth/login?next=${encodeURIComponent(href)}`);
      return;
    }

    // --- server first ---
    let added: boolean | undefined;
    try {
      const res = await toggleFavoriteMutation({
        userId: profile._id as Id<"profiles">,
        gameId: game._id as Id<"games">,
      } as any);

      added =
        (res as any)?.added === true ||
        (res as any)?.status === "added" ||
        (res as any)?.result === "added" ||
        (res as any) === true;
    } catch {
      toast({
        title: "No se pudo actualizar favoritos",
        description: "Inténtalo nuevamente.",
        variant: "destructive",
      });
      return;
    }

    // --- espejo UI: mantener header en sync
    const item = {
      id: String(game._id),
      title: game.title ?? "Juego",
      cover: (game as any).cover_url ?? "/placeholder.svg",
      priceBuy: typeof buy === "number" ? buy : null,
      priceRent: typeof rent === "number" ? rent : null,
    };

    if (typeof added !== "boolean") added = !isFav;

    if (added) {
      addFav(item);
      toast({ title: "Añadido a favoritos", description: item.title });
    } else {
      removeFav(item.id);
      toast({ title: "Quitado de favoritos", description: item.title });
    }

    try {
      window.dispatchEvent(new Event("pv:favorites:changed"));
    } catch {}
  };

  return (
    <Link href={`/juego/${game._id}`} className="block h-full cursor-pointer">
        <Card
          className="
            relative h-full flex flex-col bg-slate-800 border-slate-700
            transition duration-300 ease-out cursor-pointer
            hover:shadow-lg hover:shadow-amber-500/5 hover:border-amber-400/40
            group
            rounded-2xl p-0 gap-0
          "
        >
        {/* ===== header (cover + overlay limpio) ===== */}
        <div className={`relative w-full ${ASPECT} overflow-hidden bg-slate-900 rounded-t-2xl`}>
          {/* Fondo blur para rellenar sin bandas */}
          <div
            className="
              absolute inset-0 bg-center bg-cover blur-2xl scale-110 opacity-60
              transition-transform duration-300 group-hover:scale-125
            "
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
          {/* Imagen principal */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={game.title}
            loading="lazy"
            decoding="async"
            className="
              absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
              min-w-full min-h-full w-auto h-auto object-cover
              [transform-origin:center] scale-[1.01]
              transition-transform duration-300 ease-out
              group-hover:scale-[1.02]
              pointer-events-none
            "
          />
          {/* Degradados para legibilidad */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

          {/* Barra de controles sobre el cover */}
          <div className="absolute inset-x-0 top-0 p-2 sm:p-3">
            <div className="flex items-start justify-between gap-2">
                             {/* Badges a la izquierda */}
               <div className="flex items-center gap-2">
                 <Badge className="bg-amber-400 text-slate-900 font-semibold px-2 py-0.5">
                   {primaryGenre}
                 </Badge>
               </div>

              {/* Corazón a la derecha */}
              <button
                onClick={handleToggleFavorite}
                className="
                  rounded-full bg-slate-900/70 p-1.5
                  ring-1 ring-white/10 transition
                  hover:bg-slate-900/90 hover:ring-amber-400/50
                "
                aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                type="button"
              >
                <Heart
                  className={`w-4 h-4 ${isFav ? "text-amber-300" : "text-slate-200/90"}`}
                  fill={isFav ? "currentColor" : "none"}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ===== body ===== */}
        <CardContent className="p-0 flex-1 flex flex-col rounded-b-2xl bg-[#161f2e]">

          <div className="h-[1px] w-full bg-slate-700" />

          <div className="p-4 flex-1 flex flex-col">
            {/* rating y plan */}
            <div className="flex items-center justify-between mb-2">
              {/* rating */}
              {typeof userStars === "number" && userStars > 0 ? (
                <div
                  className="
                    inline-flex items-center gap-1 rounded-md bg-slate-900/70 ring-1 ring-slate-600
                    px-2 py-1 text-xs w-fit
                    transition-colors group-hover:ring-amber-400/50
                    cursor-default
                  "
                  title={`User rating: ${userStars.toFixed(1)}/5`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-slate-200 font-semibold">
                    {userStars.toFixed(1)}
                  </span>
                </div>
              ) : (
                <div></div>
              )}

              {/* Badge del plan */}
                <Badge className={`font-semibold px-2 py-0.5 text-xs ${
                  isPremiumPlan 
                    ? "bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-slate-900" 
                    : "bg-teal-400 text-slate-900"
                }`}>
                {isPremiumPlan ? "Premium" : "Free"}
              </Badge>
            </div>

            <h3 className="text-slate-100 font-semibold text-lg mb-1 line-clamp-1">
              {game.title}
            </h3>

            <p className="text-slate-400 text-sm mb-4 line-clamp-2">
              {game.description || "Sin descripción por ahora."}
            </p>

            {/* ======= PRECIOS ======= */}
            {((typeof rent === "number" && rent > 0) || (typeof buy === "number" && buy > 0)) ? (
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                {/* Alquiler */}
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-slate-300">Alquiler</span>
                  {typeof rent === "number" && rent > 0 ? (
                    showRentDiscount ? (
                      <div className="flex flex-col items-start space-y-0.5">
                        <span className="text-slate-400 line-through text-[12px] leading-4 whitespace-nowrap tabular-nums">
                          {formatCurrency(rent, currency)}
                          {rentSuffix && <span className="font-normal">{rentSuffix}</span>}
                        </span>
                        <span className="text-white font-bold text-[15px] leading-5 whitespace-nowrap tabular-nums">
                          {formatCurrency(rentFinal!, currency)}
                          {rentSuffix && <span className="font-semibold">{rentSuffix}</span>}
                        </span>
                      </div>
                    ) : (
                      <span className="text-white font-bold text-[15px] leading-5 whitespace-nowrap tabular-nums">
                        {formatCurrency(rent, currency)}
                        {rentSuffix && <span className="font-semibold">{rentSuffix}</span>}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>

                {/* Compra */}
                <div className="flex min-w-0 flex-col items-end text-right">
                  <span className="text-slate-300">Compra</span>
                  {typeof buy === "number" && buy > 0 ? (
                    showBuyDiscount ? (
                      <div className="flex flex-col items-end space-y-0.5">
                        <span className="text-slate-400 line-through text-[12px] leading-4 whitespace-nowrap tabular-nums">
                          {formatCurrency(buy, currency)}
                        </span>
                        <span className="text-slate-100 font-bold text-[15px] leading-5 whitespace-nowrap tabular-nums">
                          {formatCurrency(buyFinal!, currency)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-100 font-bold text-[15px] leading-5 whitespace-nowrap tabular-nums">
                        {formatCurrency(buy, currency)}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
              </div>
            ) : ((typeof rent === "number" && rent === 0) || (typeof buy === "number" && buy === 0)) ? (
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                {/* Juego Free to Play */}
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-slate-300">Juego Free to Play</span>
                  <span className="text-emerald-300 font-bold text-[15px] leading-5 whitespace-nowrap">
                    Gratis
                  </span>
                </div>

                {/* Espacio vacío para mantener el layout */}
                <div className="flex min-w-0 flex-col items-end text-right">
                </div>
              </div>
            ) : null}
                         {/* ======= /PRECIOS ======= */}

                           {/* leyendas */}
              {((typeof rent === "number" && rent > 0) || (typeof buy === "number" && buy > 0)) && (
                <p
                  className={`mt-3 text-[11px] ${
                    isPremiumUser ? "text-amber-300" : "text-slate-400"
                  }`}
                >
                  {isPremiumUser 
                    ? "Estas usando 10% de descuento de PlayVerse Premium" 
                    : "Aprovecha 10% de descuento suscribiéntode a premium"}
                </p>
              )}

          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
