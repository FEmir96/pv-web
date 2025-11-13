// playverse-web/app/mis-juegos/page.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ShoppingBag,
  Clock,
  Repeat2,
  ChevronDown,
  Play,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { CoverBox } from "@/components/CoverBox";

/* ────────────────────────────────────────────── */

type PurchaseRow = {
  _id: string;
  game?: { _id?: Id<"games">; title?: string; cover_url?: string };
  gameId?: Id<"games">;
  title?: string;
  createdAt?: number;
};

type RentalRow = {
  _id: string;
  game?: { _id?: Id<"games">; title?: string; cover_url?: string };
  gameId?: Id<"games">;
  expiresAt?: number | null;
};

type MinimalGame = {
  _id: Id<"games">;
  title: string;
  igdbId?: number | null;
  ageRatingLabel?: string | null;
  genres?: string[] | null;
};

const norm = (s?: string | null) => String(s || "").trim().toLowerCase();

function fmtDate(ts?: number | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ────────────────── CARD ────────────────── */

type LibraryCardProps = {
  id: string;
  title: string;
  cover?: string | null;
  genre?: string | null;
  kind: "rental" | "purchase";
  expiresAt?: number | null;
};

function LibraryCard({ id, title, cover, genre, kind, expiresAt }: LibraryCardProps) {
  const gameDoc = useQuery(
    (api as any).queries.getGameById.getGameById as any,
    id ? ({ id } as any) : "skip"
  ) as (Doc<"games"> | null | undefined);

  const isPremiumPlan = (gameDoc as any)?.plan === "premium";
  const isRental = kind === "rental";
  const now = Date.now();
  const isExpired = isRental && typeof expiresAt === "number" && expiresAt <= now;

  const playHref = `/play/${id}`;
  const extendHref = `/checkout/extender/${id}`;

  return (
    <div
      className="
        rounded-2xl bg-slate-900 border border-slate-700
        hover:border-amber-400/40 hover:shadow-xl hover:shadow-amber-500/10
        transition-all duration-200 overflow-hidden
      "
    >
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-3">
          <Badge className="bg-amber-400 text-slate-900 px-2 py-0.5">
            {genre || "Acción"}
          </Badge>
          <Badge
            className={`font-semibold px-2 py-0.5 text-xs ${isPremiumPlan
              ? "bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-slate-900"
              : "bg-teal-400 text-slate-900"
              }`}
          >
            {isPremiumPlan ? "Premium" : "Free"}
          </Badge>
        </div>

        <CoverBox
          src={cover || "/placeholder.svg"}
          alt={title}
          ratio="5/7"
          fit="cover"
          className="rounded-xl"
        />
      </div>

      <div className="px-5 pb-5 pt-4">
        <h3 className="text-slate-100 font-semibold text-xl">{title}</h3>

        {isRental ? (
          isExpired ? (
            <p className="mt-3 text-[13px] font-semibold text-rose-300">Caducado</p>
          ) : (
            <p className="mt-3 text-[13px] font-semibold text-emerald-300">
              Válido hasta el {fmtDate(expiresAt)}
            </p>
          )
        ) : (
          <p className="mt-3 text-[13px] text-slate-300">Compra permanente</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          {/* Jugar */}
          <Link href={playHref} className="flex-1">
            <Button
              className="
                w-full justify-center gap-2 rounded-xl
                bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold
                focus-visible:ring-2 focus-visible:ring-orange-400/70
              "
            >
              <Play className="w-4 h-4" />
              Jugar
            </Button>
          </Link>

          {/* Extender */}
          {isRental && (
            <Link href={extendHref}>
              <Button
                variant="outline"
                className="
                  rounded-xl px-4
                  bg-sky-500/15 text-sky-200
                  border border-sky-400/40
                  hover:bg-sky-500/25 hover:text-white
                  focus-visible:ring-2 focus-visible:ring-sky-400/60
                "
              >
                <Repeat2 className="w-4 h-4 mr-2" />
                {isExpired ? "Renovar" : "Extender"}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────── PAGE ────────────────── */

export default function MisJuegosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<"purchases" | "rentals">("purchases");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortType, setSortType] = useState<string>("recent"); // purchases: recent/oldest; rentals: expires_soon/expires_late

  // después de los useState(...)
  useEffect(() => {
    setSortType((prev) => {
      if (activeTab === "purchases") {
        // valores válidos: "recent" | "oldest"
        return prev === "recent" || prev === "oldest" ? prev : "recent";
      } else {
        // valores válidos: "expires_soon" | "expires_late"
        return prev === "expires_soon" || prev === "expires_late" ? prev : "expires_soon";
      }
    });
  }, [activeTab]);


  // Sincroniza ?tab=... con el estado
  useEffect(() => {
    const t = (searchParams?.get("tab") || "").toLowerCase();
    if (t === "rentals" || t === "purchases") setActiveTab(t);
  }, [searchParams]);

  // Cambia de tab y refleja en URL
  const setTab = (t: "purchases" | "rentals") => {
    setActiveTab(t);
    const params = new URLSearchParams(searchParams?.toString());
    params.set("tab", t);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const { data: session, status } = useSession();
  const email = useMemo(
    () => session?.user?.email?.toLowerCase() || null,
    [session?.user?.email]
  );
  const isLogged = Boolean(email);

  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    email ? { email } : "skip"
  ) as { _id: Id<"profiles"> } | null | undefined;

  const purchases = useQuery(
    api.queries.getUserPurchases.getUserPurchases as any,
    profile?._id ? { userId: profile._id } : "skip"
  ) as PurchaseRow[] | undefined;

  const validUserId =
    profile && typeof profile._id === "string" && profile._id.length > 0
      ? profile._id
      : null;

  const rentals = useQuery(
    api.queries.getUserRentals.getUserRentals as any,
    validUserId ? { userId: validUserId as Id<"profiles"> } : "skip"
  ) as RentalRow[] | undefined;

  const gamesMini =
    (useQuery(api.queries.listGamesMinimal.listGamesMinimal as any, {}) as
      | MinimalGame[]
      | undefined) || [];

  /* ─────────── Resolver juegos ─────────── */
  const titleLookup = useMemo(() => {
    const byTitle = new Map<string, { id: string; genre?: string | null }>();
    const byId = new Map<string, string | null>();
    const byPlan = new Map<string, string | null>();
    for (const g of gamesMini || []) {
      const key = norm(g?.title);
      const gid = String(g._id);
      const genre = g.genres?.[0] || null;
      const plan = (g as any)?.plan ?? null;
      if (key) byTitle.set(key, { id: gid, genre });
      byId.set(gid, genre);
      byPlan.set(gid, plan);
    }
    return { byTitle, byId, byPlan };
  }, [gamesMini]);

  const resolveGame = (
    explicitId?: Id<"games"> | string | null,
    titleMaybe?: string | null
  ) => {
    if (explicitId) {
      const gid = String(explicitId);
      const genre = (titleLookup as any)?.byId?.get(gid) ?? null;
      return { id: gid, genre };
    }
    const byTitle = (titleLookup as any)?.byTitle as
      | Map<string, { id: string; genre?: string | null }>
      | undefined;
    const hit = byTitle?.get(norm(titleMaybe));
    if (hit) return { id: hit.id, genre: hit.genre || null };
    return { id: "", genre: null };
  };

  /* ─────────── Filtrado y ordenamiento ─────────── */
  const now = Date.now();
  const activeRentals =
    Array.isArray(rentals)
      ? rentals.filter((r) =>
        typeof r.expiresAt === "number" ? r.expiresAt > now : true
      )
      : [];

  const dedupePurchases = (rows: PurchaseRow[]) => {
    const seen = new Set<string>();
    return rows.filter((p) => {
      const gid = String(p.game?._id ?? p.gameId ?? "");
      if (!gid || seen.has(gid)) return false;
      seen.add(gid);
      return true;
    });
  };

  const dedupeRentals = (rows: RentalRow[]) => {
    const best = new Map<string, RentalRow>();
    for (const r of rows) {
      const gid = String(r.game?._id ?? r.gameId ?? "");
      if (!gid) continue;
      const prev = best.get(gid);
      if (!prev || (r.expiresAt ?? 0) > (prev.expiresAt ?? 0)) best.set(gid, r);
    }
    return Array.from(best.values());
  };

  const filteredPurchases = useMemo(() => {
    const list = dedupePurchases(purchases || []);
    const q = norm(searchQuery);
    return list
      .filter((p) => norm(p.game?.title || p.title).includes(q))
      .sort((a, b) =>
        sortType === "oldest"
          ? (a.createdAt ?? 0) - (b.createdAt ?? 0)
          : (b.createdAt ?? 0) - (a.createdAt ?? 0)
      );
  }, [purchases, searchQuery, sortType]);

  const filteredRentals = useMemo(() => {
    const list = dedupeRentals(activeRentals);
    const q = norm(searchQuery);
    return list
      .filter((r) => norm(r.game?.title).includes(q))
      .sort((a, b) =>
        sortType === "expires_late"
          ? (b.expiresAt ?? 0) - (a.expiresAt ?? 0)
          : (a.expiresAt ?? 0) - (b.expiresAt ?? 0)
      );
  }, [activeRentals, searchQuery, sortType]);

  /* ─────────── Render principal ─────────── */
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-900 grid place-items-center text-slate-300">
        Cargando…
      </div>
    );
  }

  if (!isLogged) {
    const goLogin = () => {
      const next =
        typeof window !== "undefined" ? window.location.pathname : "/mis-juegos";
      router.push(`/auth/login?next=${encodeURIComponent(next)}`);
    };

    return (
      <div className="min-h-screen bg-slate-900 text-center pt-32">
        <p className="text-slate-300 mb-6">Necesitás iniciar sesión para ver tus juegos.</p>
        <Button
          onClick={goLogin}
          className="bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold"
        >
          Iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <section className="bg-gradient-to-b from-slate-800 to-slate-900 py-12 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-orange-400 mb-4 tracking-wide">
          MIS JUEGOS
        </h1>
        <p className="text-slate-300 text-lg max-w-3xl mx-auto leading-relaxed">
          Tu biblioteca personal: títulos alquilados o comprados.
        </p>
      </section>

      {/* Tabs */}
      <section className="py-6 bg-slate-900">
        <div className="container mx-auto px-4 flex justify-center gap-2">
          <Button
            onClick={() => setTab("purchases")}
            className={`flex items-center gap-2 ${activeTab === "purchases"
              ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
              : "border-orange-400 border-1 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
              }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Mis compras
          </Button>
          <Button
            onClick={() => setTab("rentals")}
            className={`flex items-center gap-2 ${activeTab === "rentals"
              ? "bg-orange-400 text-slate-900 hover:bg-orange-500"
              : "border-orange-400 border-1 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
              }`}
          >
            <Clock className="w-4 h-4" />
            Mis alquileres
          </Button>
        </div>
      </section>

      {/* Search + filtros */}
      <section className="py-6 bg-slate-900 border-b border-slate-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar por título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="sr-only">Ordenar</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div>
                    <Button
                      className="flex items-center gap-2 bg-slate-900 border border-amber-400 text-amber-400 px-4 py-2 rounded-xl shadow-sm hover:bg-slate-800/95"
                    >
                      {activeTab === "purchases"
                        ? (sortType === "oldest" ? "Compras más antiguas" : "Compras más recientes")
                        : (sortType === "expires_late" ? "Vence último" : "Vence primero")}
                      <ChevronDown className="w-4 h-4 text-amber-400" />
                    </Button>
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="z-50 bg-slate-900 border border-amber-400 rounded-md p-1 shadow-md text-amber-400"
                >
                  <DropdownMenuRadioGroup value={sortType} onValueChange={(v) => setSortType(v)}>
                    {activeTab === "purchases" ? (
                      <>
                        <DropdownMenuRadioItem value="recent">Compras más recientes</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="oldest">Compras más antiguas</DropdownMenuRadioItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuRadioItem value="expires_soon">Vence primero</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="expires_late">Vence último</DropdownMenuRadioItem>
                      </>
                    )}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </section>

      {/* Contenido */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {activeTab === "purchases" ? (
            filteredPurchases.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
                {filteredPurchases.map((p) => {
                  const { id: gid, genre } = resolveGame(
                    p.game?._id ?? p.gameId ?? null,
                    p.game?.title || p.title
                  );
                  return (
                    <LibraryCard
                      key={`${p._id}-${gid}`}
                      id={gid}
                      title={p.game?.title || p.title || "Juego"}
                      cover={p.game?.cover_url}
                      genre={genre}
                      kind="purchase"
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-slate-400 mt-12">
                {searchQuery ? "No se encontraron compras con ese nombre." : "No tenés compras todavía."}
              </div>
            )
          ) : filteredRentals.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
              {filteredRentals.map((r) => {
                const resolved = resolveGame(r.game?._id ?? r.gameId ?? null, r.game?.title);
                const gid = resolved.id || String(r.gameId || "");
                return (
                  <LibraryCard
                    key={`${r._id}-${gid}`}
                    id={gid}
                    title={r.game?.title || "Juego"}
                    cover={r.game?.cover_url}
                    genre={resolved.genre}
                    kind="rental"
                    expiresAt={r.expiresAt ?? null}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center text-slate-400 mt-12">
              {searchQuery ? "No se encontraron alquileres con ese nombre." : "No tenés alquileres activos."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
