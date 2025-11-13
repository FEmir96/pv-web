// playverse-web/components/OAuthToast.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/useAuthStore";
import { setFavoritesScope } from "@/components/favoritesStore";

export default function OAuthToast() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const { data: session, status } = useSession();
  const localUser = useAuthStore((s) => s.user);

  const shownRef = useRef(false);
  const oauth = search.get("oauth"); // "google" | "xbox" | null

  const displayName = useMemo(() => {
    const name =
      session?.user?.name ||
      localUser?.name ||
      session?.user?.email ||
      localUser?.email ||
      null;
    return name ? String(name).trim().split(/\s+/)[0] : null;
  }, [session?.user?.name, session?.user?.email, localUser?.name, localUser?.email]);

  const providerLabel =
    oauth === "google" ? "Google" :
    oauth === "xbox"   ? "Xbox"  :
    oauth ? oauth : "tu cuenta";

  useEffect(() => {
    if (!oauth) return;
    if (shownRef.current) return;
    if (status === "loading") return;

    shownRef.current = true;

    // 👉 Scope por usuario para favoritos
    setFavoritesScope(session?.user?.email ?? null);

    toast({
      title: displayName ? `¡Bienvenido, ${displayName}!` : "¡Bienvenido!",
      description: `Inicio de sesión con ${providerLabel} exitoso.`,
    });

    // Limpio ?oauth= de la URL
    const params = new URLSearchParams(search.toString());
    params.delete("oauth");
    const cleanUrl = `${pathname}${params.size ? `?${params.toString()}` : ""}`;
    router.replace(cleanUrl);
  }, [oauth, status, displayName, providerLabel, pathname, router, search, session?.user?.email]);

  return null;
}
