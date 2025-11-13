// playverse-web/app/providers/HouseAdProvider.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useConvex, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import HouseAdModal, { HouseAdPayload } from "@/components/ads/HouseAdModal";

type Ctx = {
  showPrePlayAd: (opts?: { gameId?: string }) => Promise<void>;
  gateOnPlayPageMount: (gameId: string) => Promise<void>;
};
const AdsCtx = createContext<Ctx>({
  showPrePlayAd: async () => {},
  gateOnPlayPageMount: async () => {},
});
export const useHouseAds = () => useContext(AdsCtx);

const DEBUG = false;
function log(...a: any[]) {
  if (DEBUG) console.debug("[HouseAds]", ...a);
}

export default function HouseAdProvider({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const router = useRouter();
  const { data: session } = useSession();

  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [ad, setAd] = useState<HouseAdPayload | null>(null);
  const [slot, setSlot] = useState<"onLogin" | "prePlay">("onLogin");
  const [pendingGameId, setPendingGameId] = useState<string | undefined>(undefined);

  const resolveRef = useRef<(() => void) | undefined>(undefined);
  const trackEvent = useMutation(api.ads.trackEvent);

  // Bloquear scroll cuando el modal está abierto
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (open) {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
    } else {
      html.style.overflow = "";
      body.style.overflow = "";
    }
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, [open]);

  // Resolver userId/role desde sesión + Convex
  useEffect(() => {
    const email = session?.user?.email;
    const guessedRole = (session?.user as any)?.role ?? null;
    setRole(guessedRole);
    if (!email) {
      setUserId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = (await convex.query(
          api.queries.getUserByEmail.getUserByEmail as any,
          { email }
        )) as any;
        if (!cancelled) {
          setUserId(p?._id ?? null);
          setRole(p?.role ?? guessedRole ?? null);
          log("profile", p?._id, p?.role);
        }
      } catch {
        if (!cancelled) setUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, session?.user, convex]);

  // Cooldown onLogin (0ms en localhost, 10min en otros)
  function canShowOnLoginNow(u: string): { ok: boolean; key: string } {
    if (typeof window === "undefined") return { ok: false, key: "" };
    const key = `pv_house_onLogin_last_${u}`;
    const last = Number(localStorage.getItem(key) || 0);
    const isLocal =
      location.hostname === "localhost" || location.hostname.startsWith("127.");
    const COOLDOWN = isLocal ? 0 : 10 * 60 * 1000;
    const ok = Date.now() - last >= COOLDOWN;
    return { ok, key };
  }

  // ON LOGIN → si role free y cooldown ok, pedimos anuncio
  useEffect(() => {
    (async () => {
      if (!userId || role !== "free") return;
      const { ok, key } = canShowOnLoginNow(userId);
      if (!ok) {
        log("onLogin cooldown");
        return;
      }
      try {
        const res = (await convex.query(api.ads.getOneForSlot as any, {
          userId,
          slot: "onLogin",
        })) as any;
        if (res?.ok && res.ad) {
          setAd(res.ad);
          setSlot("onLogin");
          setOpen(true);
          localStorage.setItem(key, String(Date.now())); // seteamos solo si mostramos
          log("onLogin ad", res.ad?.id);
        } else {
          log("onLogin none");
        }
      } catch (e) {
        log("onLogin error", e);
      }
    })();
  }, [userId, role, convex]);

  // Tracking: impresión
  useEffect(() => {
    if (!open || !ad || !userId) return;
    (async () => {
      try {
        await trackEvent({
          userId: userId as any,
          adId: ad.id as any,
          slot,
          event: "impression",
        });
        log("impression", ad.id, slot);
      } catch {}
    })();
  }, [open, ad?.id, userId, slot, trackEvent]);

  // showPrePlayAd: para botones "Jugar"
  const showPrePlayAd = useCallback(
    async ({ gameId }: { gameId?: string } = {}) => {
      if (!userId || role !== "free") return;
      try {
        const res = (await convex.query(api.ads.getOneForSlot as any, {
          userId,
          slot: "prePlay",
        })) as any;
        if (!res?.ok || !res.ad) {
          log("prePlay none");
          return; // no bloqueamos si no hay anuncio
        }
        setAd(res.ad);
        setSlot("prePlay");
        setPendingGameId(gameId);

        await new Promise<void>((resolve) => {
          resolveRef.current = resolve;
          setOpen(true);
        });
      } catch (e) {
        log("prePlay error", e);
      }
    },
    [convex, role, userId]
  );

  // gateOnPlayPageMount: para cubrir navegación directa a /play/[id]
  const gateOnPlayPageMount = useCallback(
    async (gameId: string) => {
      if (!userId || role !== "free" || !gameId) return;

      // TTL para evitar doble pre-roll al volver/reenviar
      const KEY = `pv_preplay_gate_${gameId}`;
      const last = Number(sessionStorage.getItem(KEY) || 0);
      const TTL = 2 * 60 * 1000; // 2 minutos
      if (Date.now() - last < TTL) {
        log("gate: recently shown, skip");
        return;
      }

      try {
        const res = (await convex.query(api.ads.getOneForSlot as any, {
          userId,
          slot: "prePlay",
        })) as any;

        if (!res?.ok || !res.ad) {
          log("gate prePlay none");
          return;
        }

        setAd(res.ad);
        setSlot("prePlay");
        setPendingGameId(gameId);

        await new Promise<void>((resolve) => {
          resolveRef.current = resolve;
          setOpen(true);
        });

        sessionStorage.setItem(KEY, String(Date.now()));
      } catch (e) {
        log("gate prePlay error", e);
      }
    },
    [convex, role, userId]
  );

  // Cierre / CTA
  const finish = useCallback(
    async (kind: "complete" | "click") => {
      if (ad && userId) {
        try {
          await trackEvent({
            userId: userId as any,
            adId: ad.id as any,
            slot,
            event: kind,
            gameId: pendingGameId as any,
          });
          log(kind, ad.id, slot);
        } catch {}
      }
      setOpen(false);
      setAd(null);
      setPendingGameId(undefined);
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = undefined;
      }
    },
    [ad, userId, slot, pendingGameId, trackEvent]
  );

  const onSkip = useCallback(() => finish("complete"), [finish]);
  const onCta = useCallback(async () => {
    const href = ad?.ctaHref || "/premium";
    router.push(href);
    await finish("click");
  }, [ad?.ctaHref, finish, router]);

  return (
    <AdsCtx.Provider value={{ showPrePlayAd, gateOnPlayPageMount }}>
      {children}
      <HouseAdModal open={open} ad={ad} onSkip={onSkip} onCta={onCta} />
    </AdsCtx.Provider>
  );
}
