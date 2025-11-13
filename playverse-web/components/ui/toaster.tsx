// components/ui/toaster.tsx
"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

// Barra de progreso del toast
function Progress({
  duration = 4000,
  color = "#ffb900",
}: {
  duration?: number;
  color?: string;
}) {
  const [width, setWidth] = useState(100);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(0));
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return (
    <div
      className="absolute left-0 bottom-0 h-1"
      style={{
        width: `${width}%`,
        transition: `width ${duration}ms linear`,
        backgroundColor: color,
      }}
    />
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => {
        // duración por defecto
        const duration = (props as any).duration ?? 4000;
        // color dinámico de barra (por defecto naranja)
        const barColor = (props as any)["data-bar"] ?? "#ffb900";

        return (
          <Toast
            key={id}
            {...props}
            className="relative border-[#1b5b73] bg-[#0d2f3b] text-white shadow-lg"
          >
            <div className="grid gap-1 pr-6">
              {title && (
                <ToastTitle className="text-[#ffb900] font-semibold">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="text-slate-200">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="text-slate-300 hover:text-white" />
            <Progress duration={duration} color={barColor} />
          </Toast>
        );
      })}

      {/* Posición: arriba-centro levemente a la izquierda (como pediste) */}
      <ToastViewport
        className="
          fixed top-4 left-[38%] -translate-x-1/2 z-[100]
          flex w-[92vw] max-w-[420px] flex-col gap-2 p-0"
      />
    </ToastProvider>
  );
}
