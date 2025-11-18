// components/show-login-toast.tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";

export default function ShowLoginToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  useEffect(() => {
    const loginParam = searchParams?.get("login");
    const authParam = searchParams?.get("auth");
    const provider = searchParams?.get("provider");
    const logout = searchParams?.get("logout");

    // LOGIN OK (acepta login=ok o auth=ok)
    if (loginParam === "ok" || authParam === "ok") {
      const name =
        session?.user?.name ??
        // si la sesión aún está cargando, mostramos algo genérico
        "Gamer";
      const via = provider ? ` vía ${provider}` : "";
      toast({
        title: `¡Bienvenido, ${name}!`,
        description: `Inicio de sesión exitoso${via}.`,
        duration: 4000,
        // barra naranja (default). No seteamos data-bar aquí.
      } as any);
      router.replace("/"); // limpiamos flags (?login=ok o ?auth=ok)
      return;
    }

    // LOGOUT
    if (logout === "1") {
      toast({
        title: "¡Hasta pronto!",
        description: "Sesión cerrada con éxito.",
        duration: 4000,
        // barra roja para diferenciar
        "data-bar": "#ff3b3b",
      } as any);
      router.replace("/"); // limpiamos ?logout=1
      return;
    }
  }, [searchParams, router, toast, session?.user?.name, status]);

  return null;
}
