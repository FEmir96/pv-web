"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [submittedEmail, setSubmittedEmail] = useState<string>("");

  const requestReset = useAction(api.actions.passwordReset.requestPasswordReset as any);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Ingresa un email valido.");
      setStatus("error");
      return;
    }

    setError("");
    setStatus("checking");

    try {
      const appUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
      const result = await requestReset({
        email: normalized,
        appUrl,
        userAgent,
      });

      if (!result?.ok) {
        const message =
          {
            invalid_email: "El email no es valido.",
            not_found: "No encontramos ninguna cuenta con ese email.",
            send_failed: "No pudimos enviar el correo. Intenta nuevamente.",
          }[result?.error as string] ?? "No pudimos enviar el correo. Intenta nuevamente.";
        setError(message);
        setStatus("error");
        return;
      }

      setSubmittedEmail(normalized);
      setStatus("success");
    } catch (err: any) {
      setError(err?.message ?? "No pudimos enviar el correo. Intenta nuevamente.");
      setStatus("error");
    }
  };

  if (status === "success") {
    const displayEmail = submittedEmail || email;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image src="/images/playverse-logo.png" alt="PlayVerse" width={120} height={80} className="object-contain" />
            </div>
            <h1 className="text-4xl font-bold text-orange-400 mb-2">PLAYVERSE</h1>
          </div>

          <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400 mb-2">¡Solicitud registrada!</h2>
            <p className="text-slate-300 mb-6">
              Si la dirección <strong>{displayEmail}</strong> está registrada, te enviaremos un correo con un enlace para restablecer tu contraseña. Revisá tu bandeja de entrada y spam.
            </p>
            <Link href="/auth/login">
              <Button className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold">Volver al login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/images/playverse-logo.png" alt="PlayVerse" width={120} height={80} className="object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-orange-400 mb-2">PLAYVERSE</h1>
          <p className="text-slate-300">Recuperá tu acceso</p>
        </div>

        <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="text-orange-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400">¿Olvidaste tu contraseña?</h2>
          </div>

          <p className="text-slate-400 text-center mb-6">Ingresá tu email. Te enviaremos un enlace para reestablecer tu contraseña.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <Input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400" required />
            </div>

            {status === "error" && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <Button type="submit" disabled={status === "checking"} className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold py-3">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              {status === "checking" ? "Verificando..." : "Enviar instrucciones"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-slate-400">¿Recordaste tu contraseña? </span>
            <Link href="/auth/login" className="text-orange-400 hover:text-orange-300 font-medium">Iniciá sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
