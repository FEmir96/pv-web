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

/* ===================== Helpers ===================== */
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

/* ===================== Componente ===================== */
export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const { status } = useSession();

  const [formData, setFormData] = useState({ email: "", password: "", remember: false });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const nextUrl = useMemo(() => safeInternalNext(pickNextParam(sp)), [sp]);

  useEffect(() => {
    const registered = sp?.get("registered");
    if (registered === "1") {
      toast({ title: "Cuenta creada con éxito 🎉", description: "Ya podés iniciar sesión con tu email y contraseña." });
      router.replace("/auth/login");
    }
  }, [sp, router, toast]);

  useEffect(() => {
    const saved = localStorage.getItem("pv_email");
    if (saved) setFormData((s) => ({ ...s, email: saved, remember: true }));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const dest = withWelcomeFlags(nextUrl, "session");
    router.replace(dest);
    setTimeout(() => { try { router.refresh(); } catch {} }, 0);
  }, [status, nextUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const { signIn } = await import("next-auth/react");
      const callbackUrl = buildAfterUrl(nextUrl, "credentials");

      // 🔥 NO redirige automáticamente → un solo replace nuestro
      const res = await signIn("credentials", {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setError("Credenciales inválidas");
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

      // Un solo salto (evita el doble parpadeo)
      router.replace(res?.url || callbackUrl);
    } catch (err) {
      console.error(err);
      setError("No se pudo iniciar sesión");
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
            <Image src="/images/playverse-logo.png" alt="PlayVerse" width={120} height={80} className="object-contain h-auto" priority />
          </div>
          <h1 className="text-4xl font-bold text-orange-400 mb-2">PLAYVERSE</h1>
          <p className="text-slate-300">Únete y elige tu próxima aventura</p>
        </div>

        <div className="bg-slate-800/50 border border-orange-400/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="text-orange-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-orange-400">Iniciar sesión</h2>
          </div>

          <p className="text-slate-400 text-center mb-6">Bienvenido de vuelta, gamer</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="tu@email.com" className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Tu contraseña" className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-orange-400" required />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" checked={formData.remember} onCheckedChange={(checked) => setFormData({ ...formData, remember: checked === true })} />
                <label htmlFor="remember" className="text-sm text-slate-300 cursor-pointer">Recuérdame</label>
              </div>
              <Link href="/auth/forgot-password" className="text-sm text-orange-400 hover:text-orange-300">¿Olvidaste tu contraseña?</Link>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button type="submit" disabled={pending || oauthPending} className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 font-semibold py-3">
              {pending ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="flex items-center my-4">
            <div className="h-px bg-slate-700 flex-1" />
            <span className="text-slate-400 px-3 text-sm">o continuar con</span>
            <div className="h-px bg-slate-700 flex-1" />
          </div>

          <div className="grid gap-3">
            <button type="button" onClick={loginWithGoogle} disabled={pending || oauthPending} className="w-full flex items-center justify-center gap-3 rounded-md border border-orange-400/40 bg-slate-800/60 px-4 py-2.5 text-[15px] font-medium text-slate-200 transition hover:bg-slate-800 hover:border-orange-400/70 active:scale-[0.99] cursor-pointer disabled:opacity-60" aria-label="Continuar con Google" title="Continuar con Google">
              <svg width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>

            <button type="button" onClick={loginWithXbox} disabled={pending || oauthPending} className="w-full flex items-center justify-center gap-3 rounded-md border border-[#107C10]/50 bg-slate-800/60 px-4 py-2.5 text-[15px] font-medium text-slate-200 transition hover:bg-slate-800 hover:border-[#107C10]/80 hover:shadow-[0_0_14px_rgba(16,124,16,0.35)] active:scale-[0.99] cursor-pointer disabled:opacity-60" aria-label="Continuar con Xbox" title="Continuar con Xbox">
              <svg width="18" height="18" viewBox="0 0 16 16" className="flex-shrink-0" fill="#107C10">
                <path d="M7.202 15.967a8 8 0 0 1-3.552-1.26c-.898-.585-1.101-.826-1.101-1.306 0-.965 1.062-2.656 2.879-4.583C6.459 7.723 7.897 6.44 8.052 6.475c.302.068 2.718 2.423 3.622 3.531 1.43 1.753 2.088 3.189 1.754 3.829-.254.486-1.83 1.437-2.987 1.802-.954.301-2.207.429-3.239.33m-5.866-3.57C.589 11.253.212 10.127.03 8.497c-.06-.539-.038-.846.137-1.95.218-1.377 1.002-2.97 1.945-3.95.401-.417.437-.427.926-.263.595.2 1.23.638 2.213 1.528l.574.519-.313.385C4.056 6.553 2.52 9.086 1.94 10.653c-.315.852-.442 1.707-.306 2.063.091.24.007.15-.3-.319Zm13.101.195c.074-.36-.019-1.02-.238-1.687-.473-1.443-2.055-4.128-3.508-5.953l-.457-.575.494-.454c.646-.593 1.095-.948 1.58-1.25.381-.237.927-.448 1.161-.448.145 0 .654.528 1.065 1.104a8.4 8.4 0 0 1 1.343 3.102c.153.728.166 2.286.024 3.012a9.5 9.5 0 0 1-.6 1.893c-.179.393-.624 1.156-.82 1.404-.1.128-.1.127-.043-.148ZM7.335 1.952c-.67-.34-1.704-.705-2.276-.803a4 4 0 0 0-.759-.043c-.471.024-.45 0 .306-.358A7.8 7.8 0 0 1 6.47.128c.8-.169 2.306-.17 3.094-.005.85.18 1.853.552 2.418.9l.168.103-.385-.02c-.766-.038-1.88.27-3.078.853-.361.176-.676.316-.699.312a12 12 0 0 1-.654-.319Z"/>
              </svg>
              Continuar con Xbox
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-slate-400 mt-4">
          ¿No tenés cuenta? <Link href="/auth/register" className="text-orange-400 hover:text-orange-300 font-medium">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
