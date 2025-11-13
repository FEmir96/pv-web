// playverse-web/app/juego/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Copy,
  Check,
  Play,
  Star,
  ShoppingCart,
} from "lucide-react";

import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useFavoritesStore } from "@/components/favoritesStore";

type MediaItem = { type: "image" | "video"; src: string; thumb?: string };

/* ---------------------- helpers ---------------------- */

function toEmbed(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?rel=0&modestbranding=1`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}

function StarRow({ value }: { value: number }) {
  const rounded = Math.round(value * 2) / 2;
  const full = Math.floor(rounded);
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className="w-4 h-4 text-orange-400"
          fill={i < full ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1 text-orange-400 font-semibold">
        {rounded.toFixed(1)}/5
      </span>
    </div>
  );
}

/* ======== helpers precios (robustos, no rompen nada existente) ======== */
const num = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s0 = v.trim().replace(/\s+/g, "");
    const s1 = s0.replace(/[^\d.,-]/g, "");
    const hasComma = s1.includes(",");
    const hasDot = s1.includes(".");
    let s = s1;
    if (hasComma && hasDot) {
      s = s1.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
      s = s1.replace(",", ".");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

type BestPriceHit = { path: string; val: number };

/** 🔎 Fallback profundo: encuentra precio de COMPRA en cualquier parte del objeto (evita alquiler/semana) */
function deepFindBuyPrice(game: any): number | undefined {
  if (!game || typeof game !== "object") return undefined;

  const EXCLUDE = /(rent|alquiler|rental|weekly|week|semana|suscrip|subscription|sub)/i;
  const INCLUDE = /(buy|purchase|compra|permanent|perma|flat|price|precio)/i;

  let best: BestPriceHit | null = null;

  const walk = (val: any, path: string, depth: number) => {
    if (depth > 6 || val == null) return;

    if (typeof val === "object") {
      for (const k of Object.keys(val)) {
        walk((val as any)[k], path ? `${path}.${k}` : k, depth + 1);
      }
      return;
    }

    const n =
      typeof val === "number"
        ? (Number.isFinite(val) ? val : undefined)
        : typeof val === "string"
          ? (() => {
            const s0 = val.trim().replace(/\s+/g, "");
            const s1 = s0.replace(/[^\d.,-]/g, "");
            const hasComma = s1.includes(",");
            const hasDot = s1.includes(".");
            let s = s1;
            if (hasComma && hasDot) s = s1.replace(/\./g, "").replace(",", ".");
            else if (hasComma) s = s1.replace(",", ".");
            const nn = Number(s);
            return Number.isFinite(nn) ? nn : undefined;
          })()
          : undefined;

    if (n === undefined) return;

    const p = path.toLowerCase();
    if (EXCLUDE.test(p)) return;
    if (!INCLUDE.test(p)) return;

    if (!best) best = { path, val: n };
  };

  walk(game, "", 0);

  if (process.env.NODE_ENV !== "production") {
    const hit = best as BestPriceHit | null;
    if (hit) {
      // eslint-disable-next-line no-console
      console.info("🔎 pickBuyPrice fallback:", hit.path, "=>", hit.val);
    }
  }

  return best != null ? (best as BestPriceHit).val : undefined;
}

function pickBuyPrice(game: any): number | undefined {
  const direct =
    num(game?.price_buy) ??
    num(game?.priceBuy) ??
    num(game?.buy_price) ??
    num(game?.purchase_price) ??
    num(game?.permanent_price) ??
    num(game?.price_permanent) ??
    num(game?.permanentPrice) ??
    num(game?.precio_compra) ??
    num(game?.precioCompra) ??
    num(game?.precio_permanente) ??
    num(game?.precio) ??
    num(game?.price) ??
    num(game?.basePrice) ??
    num(game?.flat_price) ??
    num(game?.price_flat) ??
    num(game?.flatPrice) ??
    num(game?.pricing?.buy) ??
    num(game?.pricing?.purchase) ??
    num(game?.prices?.buy) ??
    num(game?.prices?.purchase) ??
    (typeof game?.priceBuyCents === "number" ? game.priceBuyCents / 100 : undefined) ??
    (typeof game?.buyPriceCents === "number" ? game.buyPriceCents / 100 : undefined) ??
    (typeof game?.prices?.buyCents === "number" ? game.prices.buyCents / 100 : undefined);

  return direct ?? deepFindBuyPrice(game);
}

function pickRentPrice(game: any): number | undefined {
  return (
    num(game?.weekly_price) ??
    num(game?.weeklyPrice) ??
    num(game?.rent_price) ??
    num(game?.rental_price) ??
    num(game?.rentPrice) ??
    num(game?.price_weekly) ??
    num(game?.weekly) ??
    num(game?.pricing?.rent) ??
    num(game?.prices?.rentWeekly) ??
    (typeof game?.rentalPriceCents === "number" ? game.rentalPriceCents / 100 : undefined)
  );
}

function pickCurrency(game: any): string {
  return game?.currency || game?.prices?.currency || game?.pricing?.currency || "ARS";
}

function formatMoney(value: number, currency = "ARS", locale = "es-AR") {
  if (value === 0) return "Gratis";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)} ${currency}`;
  }
}

/* ======================= PAGE ======================= */
export default function GameDetailPage() {
  const params = useParams() as { id?: string | string[] } | null;
  const router = useRouter();
  const { toast } = useToast();

  // UI state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const thumbsPerView = 4;

  // Param estable
  const idParamRaw = params?.id;
  const idParam = Array.isArray(idParamRaw)
    ? (idParamRaw as string[])[0]
    : (idParamRaw as string | undefined);
  const hasId = Boolean(idParam);

  // ====== datos del juego
  const game = useQuery(
    api.queries.getGameById.getGameById as any,
    hasId ? ({ id: idParam as Id<"games"> } as any) : "skip"
  ) as Doc<"games"> | null | undefined;

  // Screenshots IGDB
  const fetchShots = useAction(api.actions.getIGDBScreenshots.getIGDBScreenshots as any);
  const [igdbUrls, setIgdbUrls] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!game?.title) return;
      try {
        const res = await fetchShots({
          title: game.title,
          limit: 8,
          size2x: true,
          minScore: 0.6,
          minScoreFallback: 0.45,
          includeVideo: false,
        } as any);
        if (!cancelled) {
          const urls = Array.isArray((res as any)?.urls) ? (res as any).urls : [];
          setIgdbUrls(urls);
        }
      } catch {
        if (!cancelled) setIgdbUrls([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [game?.title, fetchShots]);

  // Embeds + media
  const trailerEmbedPrimary = useMemo(
    () => toEmbed((game as any)?.trailer_url ?? null),
    [game?.trailer_url]
  );
  const trailerEmbedAlt = useMemo(
    () => toEmbed((game as any)?.extraTrailerUrl ?? null),
    [(game as any)?.extraTrailerUrl]
  );
  const extraImages = useMemo(() => {
    const arr = ((game as any)?.extraImages as string[] | undefined) ?? [];
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string" && s.trim()) : [];
  }, [(game as any)?.extraImages]);

  const media: MediaItem[] = useMemo(() => {
    const out: MediaItem[] = [];
    if (trailerEmbedPrimary) {
      out.push({
        type: "video",
        src: trailerEmbedPrimary,
        thumb: (game as any)?.cover_url || undefined,
      });
    }
    if (trailerEmbedAlt) {
      out.push({
        type: "video",
        src: trailerEmbedAlt,
        thumb: (game as any)?.cover_url || undefined,
      });
    }
    if (Array.isArray(igdbUrls) && igdbUrls.length) {
      out.push(...igdbUrls.map<MediaItem>((u) => ({ type: "image", src: u })));
    }
    if (extraImages.length) {
      out.push(...extraImages.map<MediaItem>((u) => ({ type: "image", src: u })));
    }
    if (out.length === 0 && (game as any)?.cover_url) {
      out.push({ type: "image", src: (game as any).cover_url });
    }
    return out;
  }, [trailerEmbedPrimary, trailerEmbedAlt, igdbUrls, extraImages, (game as any)?.cover_url]);

  useEffect(() => {
    if (selectedIndex >= media.length) setSelectedIndex(0);
  }, [media.length, selectedIndex]);

  const nextThumbs = () => {
    if (thumbStart + thumbsPerView < media.length) setThumbStart((p) => p + 1);
  };
  const prevThumbs = () => {
    if (thumbStart > 0) setThumbStart((p) => p - 1);
  };

  // ====== Sesión / Perfil / Biblioteca
  const { data: session, status: sessionStatus } = useSession();
  const loggedEmail = session?.user?.email?.toLowerCase() ?? null;
  const isLogged = sessionStatus === "authenticated" && !!loggedEmail;

  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    loggedEmail ? { email: loggedEmail } : "skip"
  ) as
    | (Doc<"profiles"> & { role?: "free" | "premium" | "admin" })
    | null
    | undefined;

  const rentals = useQuery(
    api.queries.getUserRentals.getUserRentals as any,
    profile?._id ? { userId: profile._id } : "skip"
  ) as
    | Array<{
      _id: string;
      game?: { _id?: Id<"games">; title?: string; cover_url?: string };
      gameId?: Id<"games">;
      expiresAt?: number | null;
    }>
    | undefined;

  const purchases = useQuery(
    api.queries.getUserPurchases.getUserPurchases as any,
    profile?._id ? { userId: profile._id } : "skip"
  ) as
    | Array<{
      _id: string;
      game?: { _id?: Id<"games">; title?: string; cover_url?: string };
      gameId?: Id<"games">;
      title?: string;
      createdAt?: number;
    }>
    | undefined;

  const hasLibraryQuery =
    (api as any).queries?.getUserLibrary?.getUserLibrary ?? null;
  const library = useQuery(
    hasLibraryQuery as any,
    profile?._id && hasLibraryQuery ? { userId: profile._id } : "skip"
  ) as
    | Array<{
      game?: any;
      gameId?: Id<"games">;
      type?: string;
      kind?: string;
      owned?: boolean;
    }>
    | undefined;

  const now = Date.now();
  const isAdmin = profile?.role === "admin";
  const isPremiumPlan = (game as any)?.plan === "premium";
  const isFreePlan = (game as any)?.plan === "free";
  const isPremiumSub = profile?.role === "premium";
  const isFreeUser = profile?.role === "free";

  const hasPurchased = useMemo(() => {
    if (!game?._id) return false;
    const gid = String(game._id);
    const gtitle = String(game.title || "").trim().toLowerCase();

    const fromPurchases =
      Array.isArray(purchases) &&
      purchases.some((p) => {
        const pid = String(p?.game?._id ?? p?.gameId ?? "");
        if (pid && pid === gid) return true;
        const ptitle = String(p?.game?.title ?? p?.title ?? "")
          .trim()
          .toLowerCase();
        return !!gtitle && gtitle === ptitle;
      });

    const fromLibrary =
      Array.isArray(library) &&
      library.some((row) => {
        const idMatch = String(row?.game?._id ?? row?.gameId ?? "") === gid;
        const kind = String(row?.kind ?? row?.type ?? "").toLowerCase();
        return idMatch && (kind === "purchase" || row?.owned === true);
      });

    return !!fromPurchases || !!fromLibrary;
  }, [purchases, library, game?._id, game?.title]);

  const hasActiveRental = useMemo(() => {
    if (!game?._id || !Array.isArray(rentals)) return false;
    return rentals.some((r) => {
      const same = String(r?.game?._id ?? r?.gameId ?? "") === String(game._id);
      const active = typeof r.expiresAt === "number" ? r.expiresAt > now : true;
      return same && active;
    });
  }, [rentals, game?._id, now]);

  const isEmbeddable = useMemo(() => {
    const u = (game as any)?.embed_url ?? (game as any)?.embedUrl;
    return typeof u === "string" && u.trim().length > 0;
  }, [game]);

  const canPlayBySubscription = isPremiumPlan && (isPremiumSub || isAdmin);
  const canPlayEffective =
    canPlayBySubscription || hasPurchased || hasActiveRental;

  const canExtend = !hasPurchased && hasActiveRental;
  const requiresPremium =
    isPremiumPlan && profile && profile.role !== "premium" && profile.role !== "admin";

  /* ===== Favoritos ===== */
  const { toast: toastFn } = useToast();
  const favItems = useFavoritesStore((s) => s.items);
  const addFav = useFavoritesStore((s) => s.add);
  const removeFav = useFavoritesStore((s) => s.remove);

  const shouldRunServerFav =
    process.env.NEXT_PUBLIC_USE_SERVER_FAVORITES === "1" &&
    Boolean((api as any).queries?.getUserFavorites?.getUserFavorites) &&
    Boolean(profile?._id);

  const favoritesFnRef = shouldRunServerFav
    ? (api as any).queries.getUserFavorites.getUserFavorites
    : (api as any).queries.getGameById.getGameById;

  const serverFavorites = useQuery(
    favoritesFnRef as any,
    shouldRunServerFav ? ({ userId: (profile as any)._id } as any) : "skip"
  ) as
    | Array<{ game?: { _id?: Id<"games"> }; gameId?: Id<"games"> }>
    | undefined;

  const isFavServer = useMemo(() => {
    if (!serverFavorites || !game?._id) return undefined;
    const gid = String(game._id);
    return serverFavorites.some(
      (f) => String(f?.game?._id ?? f?.gameId ?? "") === gid
    );
  }, [serverFavorites, game?._id]);

  const isFavLocal = useMemo(() => {
    const byId = !!(game?._id && favItems.some((i) => i.id === String(game._id)));
    if (byId) return true;
    const title = String(game?.title || "").trim();
    return !!title && favItems.some((i) => i.title === title);
  }, [favItems, game?._id, game?.title]);

  const isFav = (typeof isFavServer === "boolean" ? isFavServer : isFavLocal) as boolean;

  const [showAuthFav, setShowAuthFav] = useState(false);
  const [showAuthAction, setShowAuthAction] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const toggleFavoriteMutation = useMutation(
    api.mutations.toggleFavorite.toggleFavorite as any
  );

  /* ===== Carrito (server) ===== */
  const inCart = useQuery(
    (api as any).queries.cart?.hasInCart as any,
    isLogged && profile?._id && game?._id
      ? { userId: profile._id, gameId: game._id }
      : "skip"
  ) as boolean | undefined;

  const cartToggle = (api as any).mutations.cart?.toggle
    ? useMutation((api as any).mutations.cart.toggle as any)
    : null;
  const cartAdd = (api as any).mutations.cart?.add
    ? useMutation((api as any).mutations.cart.add as any)
    : null;
  const cartRemove = (api as any).mutations.cart?.remove
    ? useMutation((api as any).mutations.cart.remove as any)
    : null;

  const [cartMarked, setCartMarked] = useState<boolean>(false);
  useEffect(() => {
    if (typeof inCart === "boolean") setCartMarked(inCart);
  }, [inCart]);

  /* ===== Reanudación post-login (fav / play) ===== */
  useEffect(() => {
    if (!isLogged || !game?._id) return;
    if (typeof profile === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const post = sp.get("post");
      const gid = sp.get("gid");
      if (!post || (gid && gid !== String(game._id))) return;

      const clean = () => {
        sp.delete("post");
        sp.delete("gid");
        const url =
          window.location.pathname + (sp.toString() ? `?${sp.toString()}` : "");
        router.replace(url);
      };

      if (post === "fav") {
        onToggleFavorite();
        clean();
      } else if (post === "play") {
        handlePlay();
        clean();
      }
    } catch { }
  }, [isLogged, profile, game?._id, router]);

  /* ====== Precios calculados (solo UI) ====== */
  const currency = pickCurrency(game);
  const baseBuy = pickBuyPrice(game);
  const baseRent = pickRentPrice(game);
  // Determine whether the game is actually free to play.
  // Consider it free when the plan is explicitly `free` OR when a known price equals 0.
  // Do NOT treat missing/undefined prices as free.
  const hasBuyPrice = typeof baseBuy === "number";
  const hasRentPrice = typeof baseRent === "number";
  const isPriceZero = (hasBuyPrice && baseBuy === 0) || (hasRentPrice && baseRent === 0);
  // A game is considered free-to-play only when its price is zero OR when it's
  // marked as `plan === 'free'` and it has no explicit buy/rent prices.
  // This prevents a priced game from being treated as free just because its
  // metadata says `plan: 'free'`.
  const isFreeToPlay = Boolean(
    isPriceZero || (isFreePlan && !hasBuyPrice && !hasRentPrice)
  );
  const isPremiumViewer = isPremiumSub || isAdmin;

  const discountRate = isPremiumViewer ? 0.10 : 0;
  const buyFinal =
    typeof baseBuy === "number" ? baseBuy * (1 - discountRate) : undefined;
  const rentFinal =
    typeof baseRent === "number" ? baseRent * (1 - discountRate) : undefined;

  /* ===== Actions ===== */
  const handlePurchase = () => {
    if (!game?._id) return;
    if (!isLogged) {
      setShowAuthAction(true);
      return;
    }
    const gid = String(game._id);
    if (hasPurchased) {
      toast({ title: "Ya lo tienes", description: "Este juego ya está en tu biblioteca." });
      return;
    }
    if (requiresPremium) {
      setShowPremiumModal(true);
      return;
    }
    if (isPremiumPlan && profile?.role === "free") {
      router.push(`/checkout/compra/${gid}?pricing=flat_premium`);
      return;
    }
    router.push(`/checkout/compra/${gid}`);
  };

  const handleRental = () => {
    if (!game?._id) return;
    if (!isLogged) {
      setShowAuthAction(true);
      return;
    }
    const gid = String(game._id);
    if (hasPurchased) {
      toast({ title: "Ya comprado", description: "Ya posees este título." });
      return;
    }
    if (hasActiveRental) {
      router.push(`/checkout/extender/${gid}`);
      return;
    }
    if (requiresPremium) {
      setShowPremiumModal(true);
      return;
    }
    router.push(`/checkout/alquiler/${gid}`);
  };

  const handleExtend = () => {
    if (!game?._id) return;
    if (!isLogged) {
      setShowAuthAction(true);
      return;
    }
    router.push(`/checkout/extender/${game._id}`);
  };

  const handlePlay = () => {
    if (!game?._id) return;
    const playUrl = `/play/${game._id}`;

    // Enforce login for any play action first.
    if (!isLogged) {
      setShowAuthAction(true);
      return;
    }

    // If the game requires premium subscription, gate access to premium users (or admins)
    if (isPremiumPlan) {
      if (isAdmin || isPremiumSub || hasPurchased || hasActiveRental) {
        // Allowed to play
        if (isEmbeddable) {
          router.push(playUrl);
        } else {
          toast({ title: "Lanzando juego…", description: "¡Feliz gaming! 🎮" });
        }
        return;
      }
      setShowPremiumModal(true);
      return;
    }

    // For free games or owned/rented paid games -> allow play
    if (isFreeToPlay || canPlayEffective) {
      if (isEmbeddable) {
        router.push(playUrl);
      } else {
        // Non-embeddable: keep current UX of showing a launching toast
        toast({ title: "Lanzando juego…", description: "¡Feliz gaming! 🎮" });
      }
      return;
    }

    // Fallback: user is logged but not allowed to play
    toast({
      title: "No disponible",
      description: "Necesitás comprar o alquilar el juego para jugar.",
      variant: "destructive",
    });
  };

  const onToggleFavorite = async () => {
    if (!game?._id) return;
    if (!isLogged || !profile?._id) {
      setShowAuthFav(true);
      return;
    }

    const item = {
      id: String(game._id),
      title: game.title ?? "Juego",
      cover: (game as any).cover_url ?? "/placeholder.svg",
      priceBuy: (game as any).price_buy ?? null,
      priceRent: (game as any).weekly_price ?? null,
    };

    let addedFromServer: boolean | undefined;
    try {
      const result = await toggleFavoriteMutation({
        userId: profile._id as Id<"profiles">,
        gameId: game._id as Id<"games">,
      } as any);

      if (typeof result === "boolean") {
        addedFromServer = result;
      } else if (result && typeof result === "object") {
        addedFromServer =
          (result.added === true) ||
          (result.status === "added") ||
          (result.result === "added");
      }
    } catch {
      toast({
        title: "No se pudo actualizar en el servidor",
        description: "Se intentará nuevamente más tarde.",
        variant: "destructive",
      });
    }

    if (typeof addedFromServer !== "boolean") addedFromServer = !isFav;

    if (addedFromServer) {
      addFav(item);
      toastFn({ title: "Añadido a favoritos", description: `${item.title} se agregó a tu lista.` });
    } else {
      removeFav(item.id);
      toastFn({ title: "Quitado de favoritos", description: `${item.title} se quitó de tu lista.` });
    }

    try {
      window.dispatchEvent(new Event("pv:favorites:changed"));
    } catch { }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { }
  };

  /* ===== Metadatos e info visual ===== */
  const isLoading = hasId && game === undefined;
  const notFound = hasId && game === null;
  const current = media[selectedIndex];

  const igdbRating = (game as any)?.igdbRating as number | undefined;
  const igdbUserRating = (game as any)?.igdbUserRating as number | undefined;
  const score100 =
    typeof igdbUserRating === "number"
      ? igdbUserRating
      : typeof igdbRating === "number"
        ? igdbRating
        : undefined;
  const userStars =
    typeof score100 === "number" ? +(score100 / 20).toFixed(1) : undefined;

  const firstReleaseDate = (game as any)?.firstReleaseDate as number | undefined;
  const releaseStr =
    typeof firstReleaseDate === "number"
      ? new Date(firstReleaseDate).toLocaleDateString()
      : undefined;

  const developers = ((game as any)?.developers as string[] | undefined) ?? [];
  const publishers = ((game as any)?.publishers as string[] | undefined) ?? [];
  const languages = ((game as any)?.languages as string[] | undefined) ?? [];
  const categories = ((game as any)?.genres as string[] | undefined) ?? [];
  const ageRatingSystem = (game as any)?.ageRatingSystem as string | undefined;
  const ageRatingLabel = (game as any)?.ageRatingLabel as string | undefined;

  const showShareButton = !hasActiveRental;

  // Nueva lógica para determinar qué botones mostrar
  const shouldShowPlayButton = () => {
    // Admins always see Play.
    if (isAdmin) return true;

    // If explicitly zero-priced or included in the free plan (and no prices), offer Play.
    if (isFreeToPlay) return true;
    // If paid, only show Play when the user already owns it or has an active rental.
    return hasPurchased || hasActiveRental;
  };

  const shouldShowUpgradeModal = () => {
    // The upgrade modal should appear when the game requires PREMIUM access
    // (i.e. game plan is premium) and the user is logged but not premium/admin.
    return isPremiumPlan && isLogged && !isPremiumSub && !isAdmin;
  };

  /* ======================= RENDER ======================= */
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {!hasId && <div className="p-6 text-slate-300">Juego no encontrado.</div>}
        {hasId && isLoading && <div className="p-6 text-slate-300">Cargando…</div>}
        {hasId && notFound && <div className="p-6 text-slate-300">Juego no encontrado.</div>}

        {hasId && game && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Columna izquierda (media) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Media */}
              <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
                {current?.type === "video" ? (
                  <iframe
                    src={current.src}
                    title={game.title}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <Image
                    src={current?.src || "/placeholder.svg"}
                    alt={game.title}
                    fill
                    className="object-cover"
                  />
                )}
              </div>

              {/* Título + género */}
              <div className="bg-slate-800/70 border border-orange-400/20 rounded-lg px-4 py-3 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-orange-400">{game.title}</h1>
                <div className="flex items-center gap-2">
                  {/* replaced: category badge hidden */}{false && (
                    <Badge className="bg-orange-400 text-slate-900 hover:bg-orange-500">
                      {(game as any).genres?.[0] || "Acción"}
                    </Badge>
                  )}
                  {isPremiumPlan ? (
                    <Badge className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-slate-900 shadow-md shadow-yellow-400/50">
                      Premium
                    </Badge>
                  ) : (
                    <Badge className="bg-teal-400 text-slate-900">
                      Free
                    </Badge>
                  )}
                </div>
              </div>

              {/* Thumbs */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={prevThumbs}
                    variant="outline"
                    size="icon"
                    disabled={thumbStart === 0}
                    className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex-1 grid grid-cols-4 gap-2">
                    {media
                      .slice(thumbStart, thumbStart + thumbsPerView)
                      .map((m, idx) => {
                        const i = thumbStart + idx;
                        const selected = i === selectedIndex;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedIndex(i)}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-colors ${selected ? "border-orange-400" : "border-slate-600"
                              }`}
                            title={m.type === "video" ? "Trailer" : `Screenshot ${i + 1}`}
                          >
                            {m.type === "video" ? (
                              <>
                                <Image
                                  src={m.thumb || (game as any).cover_url || "/placeholder.svg"}
                                  alt="Trailer"
                                  width={120}
                                  height={68}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 grid place-items-center">
                                  <div className="bg-white/90 text-slate-900 rounded-full p-1">
                                    <Play className="w-4 h-4" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Image
                                src={m.src}
                                alt={`${game.title} screenshot ${i + 1}`}
                                width={120}
                                height={68}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </button>
                        );
                      })}
                  </div>

                  <Button
                    onClick={nextThumbs}
                    variant="outline"
                    size="icon"
                    disabled={thumbStart + thumbsPerView >= media.length}
                    className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Descripción */}
              <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-orange-400 mb-4">Descripción</h3>
                <p className="text-slate-300 leading-relaxed">
                  {game.description ?? "Sin descripción"}
                </p>
              </div>
            </div>

            {/* Columna derecha (acciones + info) */}
            <div className="lg:col-span-1 space-y-6">
              {/* Acciones */}
              <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
                <div className="text-center mb-4">
                  {isPremiumSub || isAdmin ? (
                    <p className="text-orange-400 text-sm">¡Felicidades! Estás aprovechando tu 10% de descuento por usar PlayVerse Premium</p>
                  ) : (
                    <p className="text-orange-400 text-sm">¡Suscribite a premium para obtener descuento en todos los títulos!</p>
                  )}
                </div>

                {/* ====== Precios ====== */}
                {(typeof baseBuy === "number" || typeof baseRent === "number") && (
                  <div className="mb-6 rounded-xl border border-orange-400/30 bg-gradient-to-br from-slate-900/60 to-slate-800/40 p-6 shadow-lg">
                    <h4 className="text-xl font-bold text-orange-400 mb-6 text-center">
                      Precios
                    </h4>

                    <div className="space-y-4">
                      {typeof baseBuy === "number" && (
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/50 border border-cyan-400/20">
                          <span className="text-slate-300 font-medium">Compra</span>
                          <div className="flex items-center gap-3">
                            {isPremiumViewer && baseBuy > 0 ? (
                              <>
                                <span className="text-slate-400 line-through text-sm">
                                  {formatMoney(baseBuy, currency)}
                                </span>
                                <span className="text-cyan-400 font-bold text-lg">
                                  {formatMoney(buyFinal!, currency)}
                                </span>
                              </>
                            ) : (
                              <span className="text-cyan-400 font-bold text-lg">
                                {formatMoney(baseBuy, currency)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {typeof baseRent === "number" && (
                        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/50 border border-emerald-400/20">
                          <span className="text-slate-300 font-medium">Alquiler semanal</span>
                          <div className="flex items-center gap-3">
                            {isPremiumViewer && baseRent > 0 ? (
                              <>
                                <span className="text-slate-400 line-through text-sm">
                                  {formatMoney(baseRent, currency)}
                                </span>
                                <span className="text-emerald-400 font-bold text-lg">
                                  {formatMoney(rentFinal!, currency)}
                                </span>
                              </>
                            ) : (
                              <span className="text-emerald-400 font-bold text-lg">
                                {formatMoney(baseRent, currency)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* ====== fin precios ====== */}

                <div className="space-y-3">
                  {/* Always prefer the Play button for free games or when the user owns/has an active rental */}
                  {hasActiveRental ? (
                    <>
                      <Button
                        onClick={handlePlay}
                        className="w-full bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold"
                      >
                        Jugar
                      </Button>
                      {canExtend && (
                        <Button
                          onClick={handleExtend}
                          variant="outline"
                          className="w-full border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
                        >
                          Extender
                        </Button>
                      )}
                    </>
                  ) : (
                    // Not actively rented
                    (() => {
                      const showPlay = shouldShowPlayButton();
                      const showUpgrade = shouldShowUpgradeModal();
                      return (
                        <>
                          {showPlay ? (
                            <>
                              <Button
                                onClick={showUpgrade ? () => setShowPremiumModal(true) : handlePlay}
                                className="w-full bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold"
                              >
                                Jugar
                              </Button>
                              {canExtend && (
                                <Button
                                  onClick={handleExtend}
                                  variant="outline"
                                  className="w-full border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
                                >
                                  Extender
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={handlePurchase}
                                variant="outline"
                                className="w-full border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900 bg-transparent font-semibold"
                              >
                                Comprar ahora
                              </Button>
                              <Button
                                onClick={handleRental}
                                variant="outline"
                                className="w-full border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-slate-900 bg-transparent font-semibold"
                              >
                                Alquilar
                              </Button>

                              {/* Carrito: only relevant for paid (non-free) titles */}
                              {!hasPurchased && !hasActiveRental && !isFreeToPlay && (
                                <Button
                                  onClick={async () => {
                                    if (!isLogged || !profile?._id || !game?._id) {
                                      setShowAuthAction(true);
                                      return;
                                    }
                                    if (requiresPremium) {
                                      setShowPremiumModal(true);
                                      return;
                                    }
                                    const prev = cartMarked;
                                    setCartMarked(!prev);
                                    try {
                                      if (cartToggle) {
                                        const res = await cartToggle({
                                          userId: profile._id,
                                          gameId: game._id,
                                        } as any);
                                        const added = !!(res as any)?.added;
                                        if (added !== !prev) setCartMarked(added);
                                        toast({
                                          title: added ? "Añadido al carrito" : "Quitado del carrito",
                                          description: `${game.title} ${added ? "se agregó" : "se quitó"} del carrito.`,
                                        });
                                      } else if (prev) {
                                        await cartRemove?.({ userId: profile._id, gameId: game._id } as any);
                                        toast({ title: "Quitado del carrito", description: `${game.title} se quitó del carrito.` });
                                      } else {
                                        await cartAdd?.({ userId: profile._id, gameId: game._id } as any);
                                        toast({ title: "Añadido al carrito", description: `${game.title} se agregó al carrito.` });
                                      }
                                    } catch {
                                      setCartMarked(prev);
                                      toast({
                                        title: "No se pudo actualizar el carrito",
                                        description: "Inténtalo nuevamente.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                  className="w-full font-semibold bg-transparent border border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900"
                                >
                                  <ShoppingCart className="w-4 h-4 mr-2" />
                                  {cartMarked ? "Quitar del carrito" : "Añadir al carrito"}
                                </Button>
                              )}
                            </>
                          )}
                        </>
                      );
                    })()
                  )}

                  {/* Favoritos + Share */}
                  <div className="flex gap-2">
                    <Button
                      onClick={onToggleFavorite}
                      variant="outline"
                      className="flex-1 border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
                    >
                      <Heart className="w-4 h-4 mr-2" fill={isFav ? "currentColor" : "none"} />
                      {isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                    </Button>

                    {showShareButton && (
                      <Button
                        onClick={() => setShowShareModal(true)}
                        variant="outline"
                        size="icon"
                        className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Información del juego */}
              <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-orange-400 mb-4">Información del juego</h3>

                <div className="space-y-3 text-sm">
                  {typeof userStars === "number" && userStars > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">User rating:</span>
                      <StarRow value={userStars} />
                    </div>
                  )}

                  {ageRatingLabel && ageRatingLabel !== "Not Rated" && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Clasificación:</span>
                      <span className="text-orange-400 font-semibold">
                        {ageRatingSystem ? `${ageRatingSystem} ${ageRatingLabel}` : ageRatingLabel}
                      </span>
                    </div>
                  )}

                  {releaseStr && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lanzamiento:</span>
                      <span className="text-white">{releaseStr}</span>
                    </div>
                  )}

                  {developers.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Desarrollador:</span>
                      <span className="text-white">{developers.join(", ")}</span>
                    </div>
                  )}
                  {publishers.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Editor:</span>
                      <span className="text-white">{publishers.join(", ")}</span>
                    </div>
                  )}

                  {categories.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Categoría:</span>
                      <span className="text-white">{categories.join(", ")}</span>
                    </div>
                  )}

                  {languages.length > 0 && (
                    <div className="">
                      <span className="block text-slate-400 mb-2">Idiomas:</span>
                      <div className="flex flex-wrap gap-2">
                        {languages.map((lang, idx) => (
                          <Badge
                            key={idx}
                            className="bg-teal-500/20 border border-teal-400/30 text-teal-200 hover:bg-teal-500/30"
                          >
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-400/30 via-teal-500/30 to-purple-600/30 rounded-lg p-6 text-center">
                <h3 className="text-xl font-bold text-white mb-2">¿Quieres más?</h3>
                <p className="text-white/90 text-sm mb-4">
                  Con premium descubrí acceso ilimitado al catálogo y descuentos exclusivos
                </p>
                <Link href="/premium">
                  <Button className="bg-white text-violet-800 hover:bg-slate-100 font-semibold">
                    Descubre premium
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="bg-slate-800 border-orange-400/30 text-white max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-orange-400 text-xl font-semibold">
              ¡Comparte este juego!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-hidden">
            <p className="text-slate-300 text-center">
              Comparte este increíble juego con tus amigos y que también disfruten de esta aventura épica.
            </p>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-orange-400/20">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400 mb-1">Link del juego:</p>
                  <p className="text-white text-sm font-mono bg-slate-900/50 p-2 rounded border break-all">
                    {typeof window !== "undefined" ? window.location.href : ""}
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={copyLink}
              className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold"
              disabled={copied}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar link
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: login requerido (Favoritos) */}
      <Dialog open={showAuthFav} onOpenChange={setShowAuthFav}>
        <DialogContent className="bg-slate-800 border-orange-400/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-400 text-xl font-semibold">
              Inicia sesión para continuar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300 text-center">
              Para añadir a favoritos debes iniciar sesión o registrarte.
            </p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowAuthFav(false)}
              className="border-slate-600 text-slate-300 bg-transparent"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const gid = String(game?._id ?? "");
                const next = `/juego/${gid}?post=fav&gid=${gid}`;
                window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
              }}
              className="bg-orange-400 hover:bg-orange-500 text-slate-900"
            >
              Iniciar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: login requerido (Comprar / Alquilar / Extender / Jugar no embebible) */}
      <Dialog open={showAuthAction} onOpenChange={setShowAuthAction}>
        <DialogContent className="bg-slate-800 border-orange-400/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-400 text-xl font-semibold">
              Inicia sesión para continuar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300 text-center">
              Para continuar debes iniciar sesión o registrarte.
            </p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowAuthAction(false)}
              className="border-slate-600 text-slate-300 bg-transparent"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const gid = String(game?._id ?? "");
                window.location.href = `/auth/login?next=${encodeURIComponent(`/juego/${gid}?post=play&gid=${gid}`)}`;
              }}
              className="bg-orange-400 hover:bg-orange-500 text-slate-900"
            >
              Iniciar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: requiere plan Premium */}
      <Dialog open={showPremiumModal} onOpenChange={setShowPremiumModal}>
        <DialogContent className="bg-slate-800 border-orange-400/30 text-white max-w-md">
          <DialogHeader className="text-center items-center">
            <DialogTitle className="text-orange-400 text-xl font-semibold text-center mx-auto">
              Se requiere PREMIUM
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-slate-300 text-center">
              Para jugar, comprar o alquilar este título es necesario contar con la
              suscripción <span className="text-amber-300 font-semibold">PREMIUM</span> de PlayVerse.
            </p>
          </div>

          <DialogFooter className="w-full">
            <div className="w-full flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPremiumModal(false)}
                className="rounded-xl px-5 py-2.5
                           bg-slate-800/40 text-slate-200
                           border border-slate-500/60
                           shadow-[inset_0_0_0_1px_rgba(148,163,184,0.25)]
                           hover:text-white hover:bg-slate-700/50
                           hover:border-orange-400/60
                           hover:shadow-[0_0_0_3px_rgba(251,146,60,0.15)]
                           focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-orange-400/60
                           transition-colors"
              >
                Cancelar
              </Button>

              <Button
                onClick={() => {
                  window.location.href = "/premium";
                }}
                className="rounded-xl px-5 py-2.5
                           bg-orange-400 text-slate-900 font-semibold
                           shadow-[0_8px_24px_rgba(251,146,60,0.35)]
                           hover:bg-orange-500
                           focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-orange-400/70
                           active:translate-y-[1px]
                           transition"
              >
                Upgrade Plan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
