"use client";

import { signOut } from "next-auth/react";
import { useAuthStore } from "@/lib/useAuthStore";

// Si tu store de favoritos expone un setter de scope, lo limpiamos también.
let clearFavScope: ((scope: string | null) => void) | null = null;
try {
  // evita romper si ese módulo cambia o no existe en build
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fav = require("@/components/favoritesStore");
  clearFavScope = fav?.setFavoritesScope ?? null;
} catch {}

export async function logoutEverywhere(callbackUrl: string = "/?logout=1") {
  try {
    // 1) Limpiar store local inmediatamente para que el UI refleje el estado
    const st = useAuthStore.getState();
    // si tu store tiene `clearUser` o `logout`, usalo; si no, setUser(null)
    if (typeof (st as any).clearUser === "function") {
      (st as any).clearUser();
    } else if (typeof (st as any).logout === "function") {
      (st as any).logout();
    } else if (typeof (st as any).setUser === "function") {
      (st as any).setUser(null);
    }

    // 2) Limpiar scope de favoritos (si lo usás)
    try {
      clearFavScope?.(null);
    } catch {}

    // 3) Quitar “remember me” opcional
    try {
      localStorage.removeItem("pv_email");
    } catch {}
  } catch {
    // noop
  }

  // 4) Cerrar sesión de NextAuth (cookie/JWT)
  await signOut({ redirect: true, callbackUrl });
}
