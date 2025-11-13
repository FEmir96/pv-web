// playverse-web/lib/useAuthStore.ts
"use client";

import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";

export type UserProfile = {
  _id: string;
  name: string;
  email: string;
  role: "free" | "premium" | "admin";
  createdAt: number;
  /** opcional: usado cuando el login viene por Google */
  avatarUrl?: string | null;
};

export type AuthState = {
  /** Perfil local (Convex / credenciales). Si usás NextAuth, esto puede quedar null. */
  user: UserProfile | null;

  /** Mantengo tu API y además permito null para facilitar logout programático. */
  setUser: (u: UserProfile | null) => void;

  /** Mantengo tu método original */
  clear: () => void;

  /** Aliases para que cualquier llamada de logout funcione a la primera */
  clearUser: () => void;
  logout: () => void;

  /** Helper opcional para el UI */
  isLogged: () => boolean;
};

const creator: StateCreator<AuthState> = (set, get) => ({
  user: null,

  // Ahora acepta null sin romper los usos existentes.
  setUser: (u) => set({ user: u }),

  // Tu método original
  clear: () => set({ user: null }),

  // Aliases para compatibilidad con helpers/botones
  clearUser: () => set({ user: null }),
  logout: () => set({ user: null }),

  // Útil en componentes
  isLogged: () => !!get().user,
});

export const useAuthStore = create<AuthState>()(
  persist(creator, {
    name: "pv_auth",
    version: 1,
    // Guardamos sólo lo necesario
    partialize: (state) => ({ user: state.user }),
    // Migra estados viejos si fuese necesario
    migrate: (persistedState, version) => {
      // hoy no hay cambios de estructura, devolvemos tal cual
      return persistedState as AuthState;
    },
  })
);
