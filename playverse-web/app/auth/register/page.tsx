// app/auth/register/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api"; // ✅ BIEN
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [oauthPending, setOauthPending] = useState(false); // nuevo

  const createUser = useMutation(api.auth.createUser);

  // destino seguro
  const nextUrl = useMemo(() => {
    const raw = searchParams?.get("next") || "/";
    const decoded = raw ? decodeURIComponent(raw) : "/";
    return decoded.startsWith("/") ? decoded : "/";
  }, [searchParams]);

  // Si hay sesión en Register, nunca nos quedamos aquí:
  useEffect(() => {
    if (status !== "authenticated") return;

    const fromOAuth = searchParams?.get("oauth") === "1";
    const name = session?.user?.name || "gamer";
    const dest = nextUrl || "/";

    if (fromOAuth) {
      toast({
        title: `¡Bienvenido, ${name}!`,
        description: "Inicio de sesión exitoso.",
      });
      const t = setTimeout(() => router.replace(dest), 650);
      return () => clearTimeout(t);
    } else {
      router.replace(dest);
    }
  }, [status, session, searchParams, nextUrl, router, toast]);

  const emailOk = formData.email.trim().length > 5 && formData.email.includes("@");
  const passOk = formData.password.length >= 6;
  const matchOk = formData.password === formData.confirmPassword;
  const termsOk = formData.acceptTerms === true;
  const usernameOk = formData.username.trim().length >= 2;
  const canSubmit = emailOk && passOk && matchOk && termsOk && usernameOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      if (!termsOk) alert("Debes aceptar los términos y condiciones");
      else if (!matchOk) alert("Las contraseñas no coinciden");
      else if (!passOk) alert("La contraseña debe tener al menos 6 caracteres");
      else alert("Revisa los datos del formulario");
      return;
    }

    setPending(true);
    const res = await createUser({
      name: formData.username.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      role: "free",
    });
    setPending(false);

    if (!res?.ok) {
      setError(res?.error ?? "No se pudo crear la cuenta");
      return;
    }

    router.push("/auth/login?registered=1");
  };

  // callback de vuelta para que Register maneje el toast y salida
  const oauthCallback = `/auth/register?oauth=1&next=${encodeURIComponent(nextUrl)}`;

  // handlers OAuth con bloqueo de doble click
  const oauthGoogle = () => {
    if (oauthPending || pending) return;
    setOauthPending(true);
    import("next-auth/react").then(({ signIn }) =>
      signIn("google", { callbackUrl: oauthCallback })
    );
  };

  const oauthXbox = () => {
    if (oauthPending || pending) return;
    setOauthPending(true);
    import("next-auth/react").then(({ signIn }) =>
      signIn("azure-ad", { callbackUrl: oauthCallback })
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 mt-7">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/playverse-logo.png"
              alt="PlayVerse"
              width={120}
              height={80}
              className="object-contain h-auto"
              priority
            />
          </div>
          <h1 className="text-4xl font-bold text-orange-400 mb-2">PLAYVERSE</h1>
          <p className="text-slate-300">Únete y elige tu próxima aventura</p>
        </div>

        <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="text-orange-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400">Crear cuenta</h2>
          </div>

          <p className="text-slate-400 text-center mb-6">Únete a la comunidad gamer</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de usuario</label>
              <Input
                type="text"
                placeholder="Tu nombre de gamer"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400"
                required
              />
              {formData.email.length > 0 && !emailOk && (
                <p className="text-xs text-red-400 mt-1">Email inválido</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirmar contraseña</label>
              <Input
                type="password"
                placeholder="Repite tu contraseña"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400"
                required
              />
              {formData.confirmPassword.length > 0 && !matchOk && (
                <p className="text-xs text-red-400 mt-1">No coinciden</p>
              )}
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, acceptTerms: checked === true })
                }
                className="border-slate-600 data-[state=checked]:bg-orange-400 data-[state=checked]:border-orange-400 mt-1"
              />
              <label htmlFor="terms" className="text-sm text-slate-300">
                Acepto los{" "}
                <Link href="/terms" className="text-orange-400 hover:text-orange-300">
                  Términos y condiciones
                </Link>
              </label>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button
              type="submit"
              disabled={!canSubmit || pending || oauthPending}
              className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Creando..." : "Registrarse"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="h-px bg-slate-700 flex-1" />
            <span className="text-slate-400 px-3 text-sm">o continuar con</span>
            <div className="h-px bg-slate-700 flex-1" />
          </div>

          {/* Botones sociales */}
          <div className="grid gap-3">
            {/* Google */}
            <button
              type="button"
              onClick={oauthGoogle}
              disabled={pending || oauthPending}
              className="w-full flex items-center justify-center gap-3 rounded-md
                         border border-orange-400/40 bg-slate-800/60 px-4 py-2.5
                         text-[15px] font-medium text-slate-200 transition
                         hover:bg-slate-800 hover:border-orange-400/70
                         active:scale-[0.99] cursor-pointer disabled:opacity-60"
              aria-label="Continuar con Google"
              title="Continuar con Google"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>

            {/* Xbox / Microsoft */}
            <button
              type="button"
              onClick={oauthXbox}
              disabled={pending || oauthPending}
              className="w-full flex items-center justify-center gap-3 rounded-md
                         border border-[#107C10]/50 bg-slate-800/60 px-4 py-2.5
                         text[15px] font-medium text-slate-200 transition
                         hover:bg-slate-800 hover:border-[#107C10]/80
                         hover:shadow-[0_0_14px_rgba(16,124,16,0.35)]
                         active:scale-[0.99] cursor-pointer disabled:opacity-60"
              aria-label="Continuar con Xbox"
              title="Continuar con Xbox"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 512 512"
                className="flex-shrink-0"
                fill="#107C10"
                aria-hidden="true"
              >
                <path d="M126.8 248.3c39.7-58.6 77.9-92.8 77.9-92.8s-42.1-48.9-92.8-67.4l-3.3-.8A224.13 224.13 0 0077.2 391c0-4.4.6-70.3 49.6-142.7zM480 256a223.71 223.71 0 00-76.6-168.7l-3.2.9c-50.7 18.5-92.9 67.4-92.9 67.4s38.2 34.2 77.9 92.8c49 72.4 49.6 138.3 49.5 142.7A222.8 222.8 0 00480 256zM201.2 80.9c29.3 13.1 54.6 34.6 54.6 34.6s25.5-21.4 54.8-34.6c36.8-16.5 64.9-11.3 72.3-9.5a224.06 224.06 0 00-253.8 0c7.2-1.8 35.2-7.1 72.1 9.5zM358.7 292.9C312.4 236 255.8 199 255.8 199s-56.3 37-102.7 93.9c-39.8 48.9-54.6 84.8-62.6 107.8l-1.3 4.8a224 224 0 00333.6 0l-1.4-4.8c-8-23-22.9-58.9-62.7-107.8z" />
              </svg>
              Continuar con Xbox
            </button>
          </div>
          <div className="mt-6 text-center">
            <span className="text-slate-400">Ya tienes una cuenta? </span>
            <Link href="/auth/login" className="text-orange-400 hover:text-orange-300 font-medium">
              Inicia sesion aqui
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
