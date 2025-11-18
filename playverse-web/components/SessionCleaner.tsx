"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

const STORAGE_KEY = "pv_auth";

// Si la sesión de NextAuth está pero el storage se limpió (otra pestaña o cierre),
// vuelve a limpiar para evitar estados inconsistentes.
export function SessionCleaner() {
  const { status } = useSession();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "authenticated") return;

    const hasSessionStorage = sessionStorage.getItem(STORAGE_KEY);
    if (!hasSessionStorage) {
      sessionStorage.removeItem(STORAGE_KEY);
      signOut({ redirect: false }).catch(() => {});
    }
  }, [status]);

  return null;
}
