// playverse-web/lib/useAuthStore.ts
"use client";

import { create, StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserProfile = {
  _id?: string;
  name: string;
  email: string;
  role: "free" | "premium" | "admin";
  createdAt?: number;
  avatarUrl?: string | null;
  status?: string;
};

export type AuthState = {
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  clear: () => void;
  clearUser: () => void;
  logout: () => void;
  isLogged: () => boolean;
};

const creator: StateCreator<AuthState> = (set, get) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  clear: () => set({ user: null }),
  clearUser: () => set({ user: null }),
  logout: () => set({ user: null }),
  isLogged: () => !!get().user,
});

export const useAuthStore = create<AuthState>()(
  persist(creator, {
    name: "pv_auth",
    version: 2,
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ user: state.user }),
    migrate: (persistedState) => persistedState as AuthState,
  })
);
