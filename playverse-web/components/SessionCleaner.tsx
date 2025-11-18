"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/useAuthStore";
import { setFavoritesScope } from "./favoritesStore";

// Sincroniza el store local con la sesión de NextAuth y evita que se cierre solo.
export function SessionCleaner() {
  const { data: session, status } = useSession();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    const u = session.user as any;
    setUser({
      _id: u.id || u.sub,
      name: u.name || "",
      email: u.email || "",
      role: u.role || "free",
      status: u.status || "Activo",
    });
    setFavoritesScope(u.email || null);
  }, [status, session?.user, setUser]);

  return null;
}
