// components/CartButton.tsx
"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "./cartStore";
import { useEffect, useState } from "react";

export default function CartButton() {
  const count = useCartStore((s) => s.items.length);
  // forzar re-render si otros tabs modifican el carrito
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((x) => x + 1);
    window.addEventListener("pv:cart:changed", h);
    return () => window.removeEventListener("pv:cart:changed", h);
  }, []);

  return (
    <Link
      href="/checkout/carrito"
      className="relative inline-flex items-center justify-center rounded-full p-2 text-amber-300 hover:text-amber-200 hover:bg-white/5 transition"
      title="Carrito"
    >
      <ShoppingCart className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 text-xs font-bold bg-amber-400 text-slate-900 rounded-full min-w-[20px] h-[20px] px-1 grid place-items-center">
          {count}
        </span>
      )}
    </Link>
  );
}
