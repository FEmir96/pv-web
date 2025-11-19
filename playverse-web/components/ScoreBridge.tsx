"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReference } from "convex/server";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/lib/useAuthStore";

export default function ScoreBridge() {
  // ✅ Igual que en PulseRiders: path string + FunctionReference
  const submitScore = useMutation(
    (
      (api as any)["mutations/scores/submitScore"] as {
        submitScore: FunctionReference<"mutation">;
      }
    ).submitScore
  );

  const { data: session } = useSession();
  const localUser = useAuthStore((s) => s.user);

  const email = (session?.user?.email || localUser?.email || "")
    .toLowerCase()
    .trim();

  const submittingRef = useRef(false);

  useEffect(() => {
    const handler = async (ev: MessageEvent) => {
      const data = ev.data;

      if (!data || typeof data !== "object") return;
      if (data.type !== "pv-score") return;

      if (!email) {
        console.warn("[ScoreBridge] Score recibido pero sin email activo");
        return;
      }

      if (submittingRef.current) return;

      const score = typeof data.score === "number" ? data.score : 0;
      if (score <= 0) {
        console.warn("[ScoreBridge] Score inválido:", score);
        return;
      }

      const embedUrl =
        typeof data.embedUrl === "string" && data.embedUrl.length > 0
          ? data.embedUrl
          : "/arena";

      submittingRef.current = true;

      try {
        console.log("[ScoreBridge] Enviando score a Convex…", {
          score,
          email,
          embedUrl,
        });

        await submitScore({
          score,
          userEmail: email,
          embedUrl,
        } as any);

        console.log("[ScoreBridge] Score enviado OK ✔");
      } catch (err) {
        console.error("[ScoreBridge] Error al enviar score", err);
        submittingRef.current = false; // permitir reintento si falla
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [email, submitScore]);

  return null;
}
