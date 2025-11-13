"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Cliente que detecta rutas de juegos (ej. /static-games)
 * - oculta el footer global (div#site-footer)
 * - previene scroll del documento mientras el juego está activo
 */
export default function GameModeManager() {
  const pathname = usePathname();

  useEffect(() => {
    const isGame = !!pathname && pathname.startsWith("/static-games");
    const html = document.documentElement;
    const body = document.body;
    const footer = document.getElementById("site-footer");

    if (isGame) {
      // Evitar scroll de la página principal y ocultar el footer global
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      if (footer) footer.style.display = "none";
    } else {
      // Restaurar estilos al salir
      html.style.overflow = "";
      body.style.overflow = "";
      if (footer) footer.style.display = "";
    }

    // cleanup por si hay navegación rápida
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
      if (footer) footer.style.display = "";
    };
  }, [pathname]);

  return null;
}