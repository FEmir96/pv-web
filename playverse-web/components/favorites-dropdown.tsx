// playverse-web/components/favorites-dropdown.tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Trash2 } from "lucide-react";
import { useFavoritesStore } from "@/components/favoritesStore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// sesión + convex
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/useAuthStore";
import type { AuthState } from "@/lib/useAuthStore";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function FavoritesDropdown({ isOpen, onClose }: Props) {
  const { toast } = useToast();
  const items = useFavoritesStore((s) => s.items);
  const remove = useFavoritesStore((s) => s.remove);

  // ======== Convex + sesión (solo para poder llamar al toggle del server) ========
  const { data: session } = useSession();
  const localUser = useAuthStore((s: AuthState) => s.user);
  const loginEmail =
    session?.user?.email?.toLowerCase() || localUser?.email?.toLowerCase() || null;

  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    loginEmail ? { email: loginEmail } : "skip"
  ) as { _id?: Id<"profiles"> } | null | undefined;

  const toggleFavorite = useMutation(
    api.mutations.toggleFavorite.toggleFavorite as any
  );

  // Sólo Escape para accesibilidad (click-afuera lo maneja Header)
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handler = () => { };
    window.addEventListener("pv:favorites:changed", handler);
    return () => window.removeEventListener("pv:favorites:changed", handler);
  }, []);

  const hasItems = items && items.length > 0;

  // Panel responsive: fixed en mobile, absolute en >= sm. SIN overflow aquí.
  return (
    <div
      ref={wrapRef}
      role="dialog"
      aria-hidden={!isOpen}
      className={[
        "fixed sm:absolute z-50",
        "inset-x-2 sm:inset-auto sm:right-0",
        "top-16 sm:top-[calc(100%+8px)]",
        "w-full sm:w-[380px] mx-auto sm:mx-0",
        "transition-all duration-200 ease-out",
        isOpen
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-y-1 scale-95 pointer-events-none",
      ].join(" ")}
    >
      <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-cyan-400/50 via-orange-400/40 to-purple-500/40">
        <div className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-300">
                Mis Favoritos
              </h3>
              <span className="px-2 py-0.5 text-xs rounded-full bg-orange-400/20 text-orange-300 border border-orange-400/30">
                {items.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 rounded-md transition-all duration-200
                         hover:text-orange-300 hover:bg-orange-400/10
                         hover:shadow-[0_0_12px_rgba(251,146,60,0.30)]
                         hover:ring-1 hover:ring-orange-400/30
                         focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-orange-400/60"
              aria-label="Cerrar"
              title="Cerrar"
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista: ÚNICO lugar con overflow */}
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain divide-y divide-slate-800">
            {!hasItems ? (
              <div className="p-6 text-center text-slate-400">
                No agregaste juegos aún.
              </div>
            ) : (
              items.map((g) => (
                <div
                  key={g.id}
                  className="p-3 transition-all duration-200 rounded-none
                             hover:bg-slate-800/50 hover:shadow-[0_0_14px_rgba(251,146,60,0.15)]
                             hover:ring-1 hover:ring-orange-400/20"
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 rounded-lg overflow-hidden ring-1 ring-slate-700">
                      <Image
                        src={g.cover || "/placeholder.svg"}
                        alt={g.title}
                        width={56}
                        height={56}
                        className="object-cover w-14 h-14"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        {/* Título */}
                        <Link
                          href={`/juego/${g.id}`}
                          onClick={onClose}
                          className="text-orange-400 hover:text-orange-300 hover:underline font-medium truncate transition-colors"
                          title={g.title}
                        >
                          {g.title}
                        </Link>

                        {/* Quitar */}
                        <button
                          onClick={async () => {
                            // 1) UI optimista
                            remove(g.id);
                            try {
                              window.dispatchEvent(new Event("pv:favorites:changed"));
                            } catch { }
                            toast({
                              title: "Eliminado de favoritos",
                              description: `${g.title} se quitó de tu lista.`,
                            });

                            // 2) Server
                            try {
                              if (profile?._id) {
                                const res = await toggleFavorite({
                                  userId: profile._id as Id<"profiles">,
                                  gameId: g.id as unknown as Id<"games">,
                                } as any);

                                const added =
                                  typeof res === "boolean"
                                    ? res
                                    : !!(
                                      res &&
                                      (res.added === true ||
                                        res.status === "added" ||
                                        res.result === "added")
                                    );

                                if (added) {
                                  await toggleFavorite({
                                    userId: profile._id as Id<"profiles">,
                                    gameId: g.id as unknown as Id<"games">,
                                  } as any);
                                }
                              }
                            } catch (err) {
                              console.error("toggleFavorite (trash) error:", err);
                            }
                          }}
                          className="text-slate-400 rounded-md transition-all duration-200
                                     hover:text-red-400 hover:bg-red-400/10
                                     hover:shadow-[0_0_12px_rgba(248,113,113,0.25)]
                                     hover:ring-1 hover:ring-red-400/30
                                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                          title="Quitar de favoritos"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {hasItems && (
            <div className="px-4 py-3 bg-slate-900/80 flex justify-end">
              <Link href="/mis-juegos" onClick={onClose}>
                <Button className="bg-orange-400 hover:bg-orange-500 text-slate-900">
                  Ver biblioteca
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
