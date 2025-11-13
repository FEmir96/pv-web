// playverse-web/components/header.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Heart, User, LogOut, Shield, ShoppingCart, Menu } from "lucide-react";
import { FavoritesDropdown } from "./favorites-dropdown";
import { NotificationsDropdown } from "./notifications-dropdown";
import { CartDropdown } from "./cart-dropdown";

import { useAuthStore } from "@/lib/useAuthStore";
import type { AuthState } from "@/lib/useAuthStore";
import { useSession } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useFavoritesStore, setFavoritesScope } from "@/components/favoritesStore";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { useToast } from "@/hooks/use-toast";

export function Header() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [showFavorites, setShowFavorites] = useState(false);
  const [showCart, setShowCart] = useState(false); // ⬅️ NUEVO
  const [loggingOut, setLoggingOut] = useState(false);

  const { toast } = useToast();
  const firedWelcome = useRef(false);

  const localUser = useAuthStore((s: AuthState) => s.user);
  const clearAuth = useAuthStore((s: AuthState) => s.clear);

  const { data: session, status } = useSession();

  const logged = useMemo(
    () => status === "authenticated" || Boolean(localUser),
    [status, localUser]
  );

  const loginEmail =
    session?.user?.email?.toLowerCase() ||
    localUser?.email?.toLowerCase() ||
    null;

  const profile = useQuery(
    api.queries.getUserByEmail.getUserByEmail as any,
    loginEmail ? { email: loginEmail } : "skip"
  ) as ({ _id: Id<"profiles">; name?: string; role?: "free" | "premium" | "admin" } | null | undefined);

  const role = (profile?.role as any) || "free";
  const userId: Id<"profiles"> | null = profile?._id ?? null;

  const displayName = profile?.name ?? session?.user?.name ?? localUser?.name ?? undefined;
  const displayEmail = session?.user?.email ?? localUser?.email ?? undefined;

  const shouldShowPremium = !logged || role === "free" || role === "admin";

  const isActiveLink = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const getLinkClasses = (href: string) => {
    const base = "font-medium transition-all duration-200 px-3 py-2 relative rounded-md text-orange-400";
    if (isActiveLink(href)) {
      return [base, "after:content-[''] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-orange-400 after:rounded-full"].join(" ");
    }
    return [base, "hover:text-amber-300", "hover:bg-orange-400/10 hover:shadow-[0_0_12px_rgba(251,146,60,0.25)]"].join(" ");
  };

  useEffect(() => {
    const scope = loginEmail ?? "__guest__";
    setFavoritesScope(scope);
  }, [loginEmail]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      clearAuth();
      try { localStorage.removeItem("pv_email"); } catch { }
      setFavoritesScope("__guest__");

      if (status === "authenticated") {
        const { signOut } = await import("next-auth/react");
        await signOut({ redirect: false });
      }
      router.replace("/?logout=1");
    } catch {
      if (typeof window !== "undefined") window.location.href = "/?logout=1";
    } finally {
      setLoggingOut(false);
    }
  };

  const favCount = useFavoritesStore((s) => s.items.length);

  // ✅ contador del carrito (con safeguard por si aún no existe la función)
  const cartCountRef = (api as any).queries?.cart?.getCartCount as any;
  const cartCount = cartCountRef
    ? (useQuery(cartCountRef, userId ? { userId } : "skip") as number | undefined)
    : 0;

  // Bienvenida post login
  useEffect(() => {
    const auth = searchParams.get("auth");
    const provider = (searchParams.get("provider") || "").toLowerCase();
    if (auth !== "ok" || !logged) return;
    if (typeof profile === "undefined") return;

    if (!firedWelcome.current) {
      firedWelcome.current = true;
      const provLabel =
        provider === "xbox" ? "Xbox" :
          provider === "google" ? "Google" :
            provider === "credentials" ? "tu cuenta" : "tu cuenta";
      const nameForToast = profile?.name || session?.user?.name || localUser?.name || "gamer";
      (toast as any)({ title: `¡Bienvenido, ${nameForToast}!`, description: `Inicio de sesión con ${provLabel} exitoso.` });

      const params = new URLSearchParams(searchParams.toString());
      params.delete("auth"); params.delete("provider");
      const nextUrl = pathname + (params.toString() ? `?${params.toString()}` : "");
      const tid = setTimeout(() => router.replace(nextUrl), 120);
      return () => clearTimeout(tid);
    }
  }, [searchParams, logged, pathname, router, toast, profile, session, localUser]);

  if (pathname.startsWith("/static-games")) return null;

  const favContainerRef = useRef<HTMLDivElement>(null);
  const cartContainerRef = useRef<HTMLDivElement>(null); // ⬅️ NUEVO

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (showFavorites && favContainerRef.current && !favContainerRef.current.contains(target)) {
        setShowFavorites(false);
      }
      if (showCart && cartContainerRef.current && !cartContainerRef.current.contains(target)) {
        setShowCart(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showFavorites) setShowFavorites(false);
        if (showCart) setShowCart(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [showFavorites, showCart]);

  return (
    <header className="bg-slate-900 border-b border-slate-700 relative">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/images/playverse-logo.png" alt="PlayVerse" width={80} height={40} className="h-10 w-auto" priority />
          </Link>

          <nav className="hidden lg:flex items-center space-x-1">
            <Link href="/" className={getLinkClasses("/")}>Inicio</Link>
            <Link href="/catalogo" className={getLinkClasses("/catalogo")}>Catálogo</Link>
            <Link href="/mis-juegos" className={getLinkClasses("/mis-juegos")}>Mis juegos</Link>
            {shouldShowPremium && <Link href="/premium" className={getLinkClasses("/premium")}>Premium</Link>}
            <Link href="/contacto" className={getLinkClasses("/contacto")}>Contacto</Link>
          </nav>

          <div className="flex items-center space-x-3">

            {logged && (
              <>
                {/* 🛒 Carrito con dropdown (NO Link directo) */}
                <div className="relative" ref={cartContainerRef}>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    className="relative text-orange-400 rounded-xl transition-all duration-200
                               hover:text-amber-300 hover:bg-orange-400/10
                               hover:shadow-[0_0_18px_rgba(251,146,60,0.35)]
                               hover:ring-1 hover:ring-orange-400/40
                               focus-visible:outline-none
                               focus-visible:ring-2 focus-visible:ring-orange-400/60"
                    onClick={() => setShowCart((v) => !v)}
                    title="Carrito"
                    aria-expanded={showCart}
                    aria-controls="cart-popover"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {(cartCount ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-400 text-slate-900 text-[11px] font-extrabold grid place-items-center leading-[18px]">
                        {(cartCount ?? 0) > 99 ? "99+" : cartCount}
                      </span>
                    )}
                  </Button>

                  <div id="cart-popover">
                    <CartDropdown
                      isOpen={showCart}
                      onClose={() => setShowCart(false)}
                      userId={userId}
                    />
                  </div>
                </div>

                <NotificationsDropdown userId={userId} />

                <div className="relative" ref={favContainerRef}>
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    className="relative text-orange-400 rounded-xl transition-all duration-200
                               hover:text-amber-300 hover:bg-orange-400/10
                               hover:shadow-[0_0_18px_rgba(251,146,60,0.35)]
                               hover:ring-1 hover:ring-orange-400/40
                               focus-visible:outline-none
                               focus-visible:ring-2 focus-visible:ring-orange-400/60"
                    onClick={() => setShowFavorites((v) => !v)}
                    title="Favoritos"
                    aria-expanded={showFavorites}
                    aria-controls="favorites-popover"
                  >
                    <Heart className="w-5 h-5" />
                    {favCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-400 text-slate-900 text-[11px] font-extrabold grid place-items-center leading-[18px]">
                        {favCount > 99 ? "99+" : favCount}
                      </span>
                    )}
                  </Button>
                  <div id="favorites-popover">
                    <FavoritesDropdown isOpen={showFavorites} onClose={() => setShowFavorites(false)} />
                  </div>
                </div>
              </>
            )}

            {!logged ? (
              <>
                <Link href="/auth/login">
                  <Button variant="outline" className="border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent hidden lg:inline-flex">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="bg-orange-400 hover:bg-orange-500 text-slate-900 font-medium hidden lg:inline-flex">
                    Registrarse
                  </Button>
                </Link>
              </>
            ) : (
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="relative text-orange-400 rounded-xl transition-all duration-200
                                   hover:text-amber-300 hover:bg-orange-400/10
                                   hover:shadow-[0_0_18px_rgba(251,146,60,0.35)]
                                   hover:ring-1 hover:ring-orange-400/40
                                   focus-visible:outline-none
                                   focus-visible:ring-2 focus-visible:ring-orange-400/60"
                        title={displayName}
                      >
                        <User className="w-5 h-5" />
                      </Button>
                    </div>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" sideOffset={8} className="z-50 bg-transparent border-0 p-0">
                    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-cyan-400/50 via-orange-400/40 to-purple-500/40">
                      <div className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden">
                        <div className="px-3 py-2 text-sm">
                          {displayName && <div className="font-semibold text-orange-400">{displayName}</div>}
                          {displayEmail && <div className="text-xs text-slate-400">{displayEmail}</div>}
                        </div>
                        <DropdownMenuSeparator className="bg-slate-700" />

                        <DropdownMenuItem asChild>
                          <Link href="/perfil" className="cursor-pointer w-full flex items-center gap-2 rounded-md transition-all duration-200 hover:bg-orange-400/10 hover:text-amber-300 hover:shadow-[0_0_18px_rgba(251,146,60,0.35)] hover:ring-1 hover:ring-orange-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 text-orange-400">
                            <User className="w-4 h-4" />
                            Ver perfil
                          </Link>
                        </DropdownMenuItem>

                        {role === "admin" && (
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href="/admin" className="cursor-pointer w-full flex items-center gap-2 rounded-md transition-all duration-200 hover:bg-orange-400/10 hover:text-amber-300 hover:shadow-[0_0_18px_rgba(251,146,60,0.35)] hover:ring-1 hover:ring-orange-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 text-orange-400">
                              <Shield className="w-4 h-4" />
                              Panel Administrador
                            </Link>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          onClick={handleLogout}
                          className={`cursor-pointer rounded-md transition-all duration-200 text-red-400 focus:text-red-400 hover:bg-red-400/10 hover:shadow-[0_0_18px_rgba(248,113,113,0.35)] hover:ring-1 hover:ring-red-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 ${loggingOut ? "opacity-60 pointer-events-none" : ""}`}
                        >
                          <LogOut className="w-4 h-4" />
                          {loggingOut ? "Cerrando..." : "Cerrar sesión"}
                        </DropdownMenuItem>
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {/* Mobile hamburger ( < 1024px ) */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-orange-400 rounded-xl transition-all duration-200 hover:text-amber-300 hover:bg-orange-400/10 hover:shadow-[0_0_18px_rgba(251,146,60,0.35)] hover:ring-1 hover:ring-orange-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                    aria-label="Abrir menú"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-slate-900 border-slate-700 text-orange-400">
                  <nav className="mt-10 flex flex-col space-y-2">
                    <SheetClose asChild>
                      <Link href="/" className="px-4 py-3 rounded-md hover:bg-orange-400/10 hover:text-amber-300 transition-colors font-bold">Inicio</Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/catalogo" className="px-4 py-3 rounded-md hover:bg-orange-400/10 hover:text-amber-300 transition-colors font-bold">Catálogo</Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href="/mis-juegos" className="px-4 py-3 rounded-md hover:bg-orange-400/10 hover:text-amber-300 transition-colors font-bold">Mis juegos</Link>
                    </SheetClose>
                    {shouldShowPremium && (
                      <SheetClose asChild>
                        <Link href="/premium" className="px-4 py-3 rounded-md hover:bg-orange-400/10 hover:text-amber-300 transition-colors font-bold">Premium</Link>
                      </SheetClose>
                    )}
                    <SheetClose asChild>
                      <Link href="/contacto" className="px-4 py-3 rounded-md hover:bg-orange-400/10 hover:text-amber-300 transition-colors font-bold">Contacto</Link>
                    </SheetClose>
                    {!logged && (
                      <div className="mt-4 space-y-2 px-2">
                        <SheetClose asChild>
                          <Button
                            asChild
                            variant="outline"
                            className="w-full border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
                          >
                            <Link href="/auth/login">Iniciar sesión</Link>
                          </Button>
                        </SheetClose>

                        <SheetClose asChild>
                          <Button
                            asChild
                            className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-medium"
                          >
                            <Link href="/auth/register">Registrarse</Link>
                          </Button>
                        </SheetClose>
                      </div>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
