// playverse-web/app/premium/success/page.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function PremiumSuccessPage() {
  const { toast } = useToast();

  useEffect(() => {
    const name = sessionStorage.getItem("pv_premium_welcome");
    if (name) {
      toast({
        title: "¡Bienvenido a Premium!",
        description: `Hola ${name}, ya tenés acceso a todos los beneficios.`,
      });
      sessionStorage.removeItem("pv_premium_welcome");
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-8">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-4">¡Bienvenido a Premium!</h1>
          <p className="text-slate-300 mb-6 leading-relaxed">
            Tu suscripción Premium ha sido activada exitosamente. Ya puedes disfrutar de todos los beneficios
            exclusivos.
          </p>

          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-slate-300">Acceso ilimitado activado</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-slate-300">Descuentos del 10% aplicados</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-slate-300">Experiencia sin anuncios</span>
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/catalogo">
              <Button className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold mb-3">
                Explorar catálogo
              </Button>
            </Link>
            <Link href="/">
              <Button
                variant="outline"
                className="w-full border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-slate-900 bg-transparent"
              >
                Ir al inicio
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
