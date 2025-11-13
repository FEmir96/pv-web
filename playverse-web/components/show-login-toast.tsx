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
    const q = searchParams?.get("login");
    const logout = searchParams?.get("logout");

    // LOGIN OK
    if (q === "ok") {
      const name =
        session?.user?.name ??
        // si la sesión aún está cargando, mostramos algo genérico
        "Gamer";
      toast({
        title: `¡Bienvenido, ${name}!`,
        description: "Inicio de sesión exitoso.",
        duration: 4000,
        // barra naranja (default). No seteamos data-bar aquí.
      } as any);
      router.replace("/"); // limpiamos ?login=ok
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
