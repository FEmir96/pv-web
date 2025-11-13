"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "@convex";

import { useAuthStore } from "@/lib/useAuthStore";
import type { AuthState } from "@/lib/useAuthStore";

function ScreenLoader() {
  return (
    <div className="min-h-[60vh] grid place-items-center bg-slate-900 text-slate-300">
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 rounded-full bg-orange-400 animate-pulse" />
        <span>Completando inicio de sesión…</span>
      </div>
    </div>
  );
}

type TraceItem = { t: number; page: string; evt: string; data?: Record<string, any> };
function pushTrace(evt: string, data?: Record<string, any>) {
  try {
    const key = "pv_trace";
    const arr: TraceItem[] = JSON.parse(sessionStorage.getItem(key) || "[]");
    arr.push({ t: Date.now(), page: "after", evt, data });
    sessionStorage.setItem(key, JSON.stringify(arr.slice(-80)));
  } catch {}
}

const getUserByEmailRef =
  (api as any)["queries/getUserByEmail"].getUserByEmail as FunctionReference<"query">;

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

function isPremiumCheckout(path: string) {
  if (!path.startsWith("/checkout/premium")) return false;
  try {
    const u = new URL(
      path,
      typeof window !== "undefined" ? window.location.origin : "https://local"
    );
    const plan = u.searchParams.get("plan");
    return plan === "monthly" || plan === "quarterly" || plan === "annual" || plan === "lifetime";
  } catch {
    return false;
  }
}

function isRoleSensitiveCheckout(path: string) {
  return (
    isPremiumCheckout(path) ||
    path.startsWith("/checkout/alquiler/") ||
    path.startsWith("/checkout/extender/")
  );
}

function needsProfileFor(nextPath: string) {
  return isRoleSensitiveCheckout(nextPath);
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

export default function AfterAuthPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const { status, data: session } = useSession();
  const localUser = useAuthStore((s: AuthState) => s.user);
  const loginEmail = session?.user?.email?.toLowerCase() || localUser?.email?.toLowerCase() || null;

  const rawNext = sp.get("next");
  const next = useMemo(() => safeInternalNext(rawNext), [rawNext]);

  const authFlag = sp.get("auth");
  const provider = sp.get("provider") || undefined;

  const profile = useQuery(
    getUserByEmailRef,
    loginEmail ? { email: loginEmail } : "skip"
  ) as { role?: "free" | "premium" | "admin" } | null | undefined;

  const didNav = useRef(false);

  useEffect(() => {
    pushTrace("MOUNT", { rawNext, next });
  }, [rawNext, next]);

  useEffect(() => {
    pushTrace("SESSION", { status, email: loginEmail });
  }, [status, loginEmail]);

  useEffect(() => {
    if (status === "loading") {
      pushTrace("WAIT_SESSION");
      return;
    }

    const go = (dest: string, reason: string) => {
      if (didNav.current) return;
      didNav.current = true;
      pushTrace("NAVIGATE", { dest, reason });
      router.replace(dest);
      // refresco (no bloquea, no duplica navegación)
      setTimeout(() => {
        try { router.refresh(); } catch {}
      }, 0);
    };

    if (status === "unauthenticated") {
      const dest = `/auth/login?next=${encodeURIComponent(next)}`;
      pushTrace("UNAUTH→LOGIN", { dest });
      go(dest, "unauthenticated");
      return;
    }

    const finalWithFlags = (d: string) =>
      authFlag === "ok" ? withWelcomeFlags(d, provider) : d;

    if (needsProfileFor(next)) {
      pushTrace("ROLE_SENSITIVE", { next, haveEmail: !!loginEmail, profileType: typeof profile });
      if (!loginEmail) return;
      if (typeof profile === "undefined") {
        pushTrace("WAIT_PROFILE");
        return;
      }
      const role = (profile?.role ?? "free") as "free" | "premium" | "admin";
      pushTrace("PROFILE_READY", { role });

      let dest = next;
      if (isPremiumCheckout(next) && role === "premium") {
        dest = "/";
        pushTrace("REWRITE_PREMIUM_TO_HOME");
      }
      go(finalWithFlags(dest), "profile-ready");
      return;
    }

    pushTrace("NO_ROLE_NEEDED", { next });
    go(finalWithFlags(next), "no-role-needed");
  }, [status, profile, next, router, authFlag, provider, loginEmail]);

  return <ScreenLoader />;
}
