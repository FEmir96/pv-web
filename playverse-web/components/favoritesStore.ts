// playverse-web/components/favoritesStore.ts
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FavoriteItem = {
  id: string;
  title: string;
  cover: string;
  priceBuy?: number | null;
  priceRent?: number | null;
};

type FavState = {
  /** Dueño de este storage (email normalizado o "guest") */
  owner: string;
  items: FavoriteItem[];
  add: (item: FavoriteItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

function broadcast() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pv:favorites:changed"));
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 *  Persistencia por usuario con “scope”:
 *   - Key base: "pv_favorites"
 *   - Scope: ":<email-normalizado>" tomado de localStorage("pv_scope") o "guest".
 *   - Migración: si existe el key legacy sin scope, se COPIA al scope actual
 *                y se BORRA para que no contamine otros usuarios.
 * ─────────────────────────────────────────────────────────────────────────── */
const FAV_KEY = "pv_favorites";
const SCOPE_KEY = "pv_scope";
const LEGACY_KEY = "pv_favorites"; // key antiguo sin scope

const normEmail = (s?: string | null) => (s || "").toLowerCase().trim();

const currentScope = () => {
  if (typeof window === "undefined") return "guest";
  const s =
    normEmail(localStorage.getItem(SCOPE_KEY)) ||
    normEmail(localStorage.getItem("pv_email"));
  return s || "guest";
};

const scopedStorage = {
  getItem: (name: string) => {
    const key = `${name}:${currentScope()}`;
    const val = localStorage.getItem(key);
    if (val !== null) return val;

    // MIGRACIÓN ÚNICA desde legacy al scope actual (y borrar legacy)
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      try {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_KEY); // evita que otros usuarios hereden
      } catch {}
      return legacy;
    }
    return null;
  },
  setItem: (name: string, value: string) => {
    const key = `${name}:${currentScope()}`;
    localStorage.setItem(key, value);
  },
  removeItem: (name: string) => {
    const key = `${name}:${currentScope()}`;
    localStorage.removeItem(key);
  },
};

export const useFavoritesStore = create<FavState>()(
  persist(
    (set, get) => ({
      owner: currentScope(),
      items: [],

      add: (item) => {
        // Garantiza que el dueño del store matchee el scope actual
        const scope = currentScope();
        if (get().owner !== scope) {
          set({ owner: scope, items: [] }); // ⬅ update parcial (sin replace=true)
        }
        const exists = get().items.some((i) => i.id === item.id);
        if (exists) return;
        set({ items: [item, ...get().items] });
        broadcast();
      },

      remove: (id) => {
        const scope = currentScope();
        if (get().owner !== scope) {
          set({ owner: scope, items: [] }); // ⬅ update parcial
        } else {
          set({ items: get().items.filter((i) => i.id !== id) });
        }
        broadcast();
      },

      clear: () => {
        const scope = currentScope();
        set({ owner: scope, items: [] }); // ⬅ update parcial
        broadcast();
      },
    }),
    {
      name: FAV_KEY,
      storage: createJSONStorage(() => scopedStorage),
      version: 4, // bump para la estructura con `owner`
      // Al rehidratar, si owner ≠ scope actual, purgamos para evitar “herencia”.
      onRehydrateStorage: () => () => {
        setTimeout(() => {
          try {
            const scope = currentScope();
            const s = useFavoritesStore.getState();
            if (s.owner !== scope) {
              useFavoritesStore.setState({ owner: scope, items: [] }); // ⬅ update parcial
              broadcast();
            }
          } catch {}
        }, 0);
      },
    }
  )
);

/** Setea el scope (email) del usuario y rehidrata el store.
 *  Llamalo SIEMPRE en login/logout (email+pass u OAuth).
 */
export function setFavoritesScope(scopeEmail?: string | null) {
  if (typeof window === "undefined") return;
  const norm = normEmail(scopeEmail) || "guest";
  localStorage.setItem(SCOPE_KEY, norm);

  // Rehidratar desde el storage del nuevo scope
  // @ts-ignore API de persist de zustand
  useFavoritesStore.persist?.rehydrate?.();

  // Verificación post-rehydrate para asegurar owner correcto
  setTimeout(() => {
    const scope = currentScope();
    const s = useFavoritesStore.getState();
    if (s.owner !== scope) {
      useFavoritesStore.setState({ owner: scope, items: [] }); // ⬅ update parcial
      broadcast();
    }
  }, 0);
}
