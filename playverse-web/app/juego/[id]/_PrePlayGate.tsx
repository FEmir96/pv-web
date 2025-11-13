// playverse-web/app/play/[id]/_PrePlayGate.tsx
"use client";

import { useEffect } from "react";
import { useHouseAds } from "@/app/providers/HouseAdProvider";

export default function PrePlayGate({ gameId }: { gameId: string }) {
  const { gateOnPlayPageMount } = useHouseAds();

  useEffect(() => {
    if (!gameId) return;
    // muestra el pre-roll si el usuario es free y no se mostró en los últimos 2 minutos
    gateOnPlayPageMount(gameId);
  }, [gameId, gateOnPlayPageMount]);

  return null;
}
