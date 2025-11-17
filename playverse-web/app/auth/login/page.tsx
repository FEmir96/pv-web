"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/useAuthStore";
import type { AuthState } from "@/lib/useAuthStore";
import { setFavoritesScope } from "@/components/favoritesStore";

function safeInternalNext(raw: string | null | undefined): string {
  const def = "/";
  if (!raw) return def;
  try {
    const dec = decodeURIComponent(raw);
    return dec.startsWith("/") ? dec : def;
  } catch {
    return def;
  }
}

function pickNextParam(sp: URLSearchParams | null): string {
  if (!sp) return "/";
  const direct = sp.get("next");
  if (direct) return direct;

  const cb = sp.get("callbackUrl");
  if (!cb) return "/";
  try {
    const u = new URL(
      decodeURIComponent(cb),
      typeof window !== "undefined" ? window.location.origin : "https://local"
    );
    const innerNext = u.searchParams.get("next");
    if (innerNext) return innerNext;
    const internal = u.pathname + u.search;
    return internal.startsWith("/") ? internal : "/";
  } catch {
    return "/";
  }
}

function withWelcomeFlags(nextPath: string, provider?: string) {
  try {
    const u = new URL(
      nextPath,
      typeof window !== "undefined" ? window.location.origin : "https://local"
    );
    u.searchParams.set("auth", "ok");
    if (provider) u.searchParams.set("provider", provider);
    return u.pathname + u.search;
  } catch {
    return nextPath;
  }
}

function buildAfterUrl(next: string, provider?: "credentials" | "google" | "xbox" | "microsoft") {
  const base = "/auth/after";
  const origin = typeof window !== "undefined" ? window.location.origin : "http://local";
  const u = new URL(base, origin);
  if (next) u.searchParams.set("next", safeInternalNext(next));
  u.searchParams.set("auth", "ok");
  if (provider) u.searchParams.set("provider", provider);
  return u.pathname + u.search;
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const { status } = useSession();

  const bannedMessage =
    "Tu cuenta ha sido suspendida, por favor comunicate con soporte desde el formulario de Contacto.";

  const [formData, setFormData] = useState({ email: "", password: "", remember: false });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const nextUrl = useMemo(() => safeInternalNext(pickNextParam(sp)), [sp]);

  useEffect(() => {
    const registered = sp?.get("registered");
    if (registered === "1") {
      toast({
        title: "Cuenta creada con exito",
        description: "Ya podes iniciar sesion con tu email y contrasena.",
      });
      router.replace("/auth/login");
    }
  }, [sp, router, toast]);

  useEffect(() => {
    const errorParam = sp?.get("error");
    if (errorParam === "ACCOUNT_BANNED") {
      setError(bannedMessage);
      toast({ title: "Cuenta suspendida", description: bannedMessage, variant: "destructive" });
    }
  }, [sp, toast, bannedMessage]);

  useEffect(() => {
    const saved = localStorage.getItem("pv_email");
    if (saved) setFormData((s) => ({ ...s, email: saved, remember: true }));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const dest = withWelcomeFlags(nextUrl, "session");
    router.replace(dest);
    setTimeout(() => {
      try {
        router.refresh();
      } catch {}
    }, 0);
  }, [status, nextUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const { signIn } = await import("next-auth/react");
      const callbackUrl = buildAfterUrl(nextUrl, "credentials");

      const res = await signIn("credentials", {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        if (res.error === "ACCOUNT_BANNED") {
          setError(bannedMessage);
          toast({ title: "Cuenta suspendida", description: bannedMessage, variant: "destructive" });
        } else {
          setError("Credenciales invalidas");
        }
        setPending(false);
        return;
      }

      if (formData.remember) {
        localStorage.setItem("pv_email", formData.email.trim().toLowerCase());
      } else {
        localStorage.removeItem("pv_email");
      }

      setFavoritesScope(formData.email.trim().toLowerCase());
      setUser({ email: formData.email.trim().toLowerCase(), name: "", role: "free" } as any);

      router.replace(res?.url || callbackUrl);
    } catch (err) {
      console.error(err);
      setError("No se pudo iniciar sesion");
      setPending(false);
    }
  };

  const loginWithGoogle = () => {
    if (oauthPending || pending) return;
    setOauthPending(true);
    import("next-auth/react").then(({ signIn }) =>
      signIn("google", { callbackUrl: buildAfterUrl(nextUrl, "google") })
    );
  };

  const loginWithXbox = () => {
    if (oauthPending || pending) return;
    setOauthPending(true);
    import("next-auth/react").then(({ signIn }) =>
      signIn("azure-ad", { callbackUrl: buildAfterUrl(nextUrl, "microsoft") })
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
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
          <p className="text-slate-300">Unite y elige tu proxima aventura</p>
        </div>

        <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="text-orange-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400">Iniciar sesion</h2>
          </div>

          <p className="text-slate-400 text-center mb-6">Bienvenido de vuelta, gamer</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="tu@email.com"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Contrasena</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Tu contrasena"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={formData.remember}
                  onCheckedChange={(checked) => setFormData({ ...formData, remember: checked === true })}
                />
                <label htmlFor="remember" className="text-sm text-slate-300 cursor-pointer">
                  Recuerdame
                </label>
              </div>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-orange-400 hover:text-orange-300"
              >
                Olvidaste tu contrasena?
              </Link>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button
              type="submit"
              disabled={pending || oauthPending}
              className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold py-3"
            >
              {pending ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="flex items-center my-4">
            <div className="h-px bg-slate-700 flex-1" />
            <span className="text-slate-400 px-3 text-sm">o continuar con</span>
            <div className="h-px bg-slate-700 flex-1" />
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={pending || oauthPending}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-orange-400/40 bg-slate-800/60 px-4 py-2.5 text-[15px] font-medium text-slate-200 transition hover:bg-slate-800 hover:border-orange-400/70 active:scale-[0.99] cursor-pointer disabled:opacity-60"
              aria-label="Continuar con Google"
              title="Continuar con Google"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </button>

            <button
              type="button"
              onClick={loginWithXbox}
              disabled={pending || oauthPending}
              className="w-full flex items-center justify-center gap-3 rounded-md border border-[#107C10]/50 bg-slate-800/60 px-4 py-2.5 text-[15px] font-medium text-slate-200 transition hover:bg-slate-800 hover:border-[#107C10]/80 hover:shadow-[0_0_14px_rgba(16,124,16,0.35)] active:scale-[0.99] cursor-pointer disabled:opacity-60"
              aria-label="Continuar con Xbox"
              title="Continuar con Xbox"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" className="flex-shrink-0" fill="#107C10">
                <path d="M8 0a8 8 0 00-8 8 8 8 0 0016 0A8 8 0 008 0zm3.928 13.272C11.274 11.79 9.632 9.72 8 7.5c-1.632 2.22-3.274 4.29-3.928 5.772C1.74 12.028 1 10.116 1 8a7 7 0 1114 0c0 2.116-.74 4.028-3.072 5.272z" />
                <path d="M9.657 5.102c.43.262.844.559 1.24.888C11.794 6.63 12.6 7.73 12.9 8.8c.108.387-.47.657-.706.282-.95-1.532-1.898-2.587-2.54-3.143a.5.5 0 01.003-.837zM6.343 5.102a.5.5 0 00-.003.837c-.642.556-1.59 1.61-2.54 3.142-.236.375-.814.105-.706-.282.3-1.07 1.106-2.169 2.003-2.81.396-.329.81-.626 1.24-.888z" />
              </svg>
              Continuar con Xbox
            </button>
          </div>

          <p className="text-center text-slate-400 text-sm mt-4">
            Todavia no tienes cuenta?{" "}
            <Link href="/auth/register" className="text-orange-400 hover:text-orange-300 font-medium">
              Registrate ahora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
