// playverse-web/components/cartStore.ts
import { create } from "zustand";

export type CartItem = {
  id: string;
  title: string;
  cover?: string;
  price: number;
  currency: "USD" | "ARS" | "EUR" | string;
};

type CartState = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  toggle: (item: CartItem) => boolean; // devuelve true si quedó añadido
  has: (id: string) => boolean;
  clear: () => void;
};

let currentScope = "__guest__";
const keyFor = (scope: string) => `pv_cart::${scope || "__guest__"}`;

function load(scope: string): CartItem[] {
  try {
    const raw = localStorage.getItem(keyFor(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as CartItem[];
    if (Array.isArray(parsed?.items)) return parsed.items as CartItem[];
  } catch {}
  return [];
}

function save(scope: string, items: CartItem[]) {
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify(items));
  } catch {}
}

export const useCartStore = create<CartState>((set, get) => ({
  items: typeof window === "undefined" ? [] : load(currentScope),

  add: (item) => {
    const items = get().items;
    if (items.some((i) => i.id === item.id)) return;
    const next = [...items, item];
    set({ items: next });
    save(currentScope, next);
  },

  remove: (id) => {
    const next = get().items.filter((i) => i.id !== id);
    set({ items: next });
    save(currentScope, next);
  },

  toggle: (item) => {
    const has = get().items.some((i) => i.id === item.id);
    if (has) {
      const next = get().items.filter((i) => i.id !== item.id);
      set({ items: next });
      save(currentScope, next);
      return false;
    } else {
      const next = [...get().items, item];
      set({ items: next });
      save(currentScope, next);
      return true;
    }
  },

  has: (id) => get().items.some((i) => i.id === id),

  clear: () => {
    set({ items: [] });
    save(currentScope, []);
  },
}));

/** Cambia el "espacio" (scope) del carrito por usuario logueado */
export function setCartScope(scope: string) {
  currentScope = scope || "__guest__";
  if (typeof window !== "undefined") {
    const items = load(currentScope);
    // remplazo hard del estado con los items del nuevo scope
    (useCartStore as any).setState({ items });
  }
}

// Sincroniza entre pestañas/ventanas
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === keyFor(currentScope)) {
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) {
          (useCartStore as any).setState({ items: parsed });
        } else if (Array.isArray(parsed?.items)) {
          (useCartStore as any).setState({ items: parsed.items });
        }
      } catch {}
    }
  });
}
