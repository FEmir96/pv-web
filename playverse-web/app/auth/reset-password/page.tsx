"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const token = sp.get("token");
  const emailParam = sp.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [pending, setPending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>(emailParam);

  const resetPassword = useMutation(api.auth.resetPasswordWithToken as any);

  const emailLabel = submittedEmail || emailParam || "tu-email@ejemplo.com";

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image src="/images/playverse-logo.png" alt="PlayVerse" width={120} height={80} className="object-contain" />
            </div>
            <h1 className="text-4xl font-bold text-orange-400 mb-2">PLAYVERSE</h1>
          </div>

          <div className="bg-slate-800/50 border border-red-400/30 rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-5V7H9v6h2zm0 2v-2H9v2h2z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400 mb-2">Enlace invalido</h2>
            <p className="text-slate-300 mb-6">
              El enlace de restablecimiento no es valido o esta incompleto. Volve a solicitar un correo para generar uno nuevo.
            </p>
            <Link href="/auth/forgot-password">
              <Button className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold">Solicitar nuevo enlace</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Ambas contrasenas deben coincidir.");
      return;
    }

    setPending(true);
    try {
      const result = await resetPassword({
        token,
        newPassword: password,
      });

      if (!result?.ok) {
        const message =
          {
            invalid_token: "El enlace no es valido o ya se uso.",
            token_used: "Este enlace ya fue utilizado.",
            token_expired: "El enlace vencio. Volve a solicitar otro.",
            user_not_found: "No encontramos tu cuenta.",
            weak_password: "La nueva contrasena debe tener al menos 6 caracteres.",
          }[result?.error as string] ?? "No pudimos restablecer la contrasena. Intenta nuevamente.";
        setError(message);
        return;
      }

      setSuccess(true);
      setSubmittedEmail(emailParam);
    } catch (err: any) {
      setError(err?.message ?? "No pudimos restablecer la contrasena. Intenta nuevamente.");
    } finally {
      setPending(false);
    }
  };

  if (success) {
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
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0L3.293 9.957a1 1 0 011.414-1.414l4.043 4.043 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400 mb-2">¡Contraseña actualizada!</h2>
            <p className="text-slate-300 mb-6">Tu contraseña para <strong>{emailLabel}</strong> fue cambiada correctamente.</p>
            <Link href="/auth/login">
              <Button className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold">Ir al login</Button>
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
          <p className="text-slate-300">Cambio de contraseña</p>
        </div>

        <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="text-orange-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 8a5 5 0 1110 0v1h1a1 1 0 110 2H4a1 1 0 110-2h1V8zm8 1V8a3 3 0 10-6 0v1h6zM5 12a1 1 0 000 2h10a1 1 0 100-2H5z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400">Reestablecer contraseña</h2>
          </div>

          <div className="mb-4 text-slate-300 text-sm">Estás cambiando la contraseña de: <strong>{emailLabel}</strong></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nueva contraseña</label>
              <Input type="password" placeholder="Tu nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Repetir contraseña</label>
              <Input type="password" placeholder="Repite tu nueva contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400" required />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button type="submit" disabled={pending} className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold py-3">
              {pending ? "Actualizando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
