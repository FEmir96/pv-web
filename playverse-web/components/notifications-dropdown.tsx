// playverse-web/components/notifications-dropdown.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Clock,
  Gamepad2,
  Gift,
  Star,
  Trash2,
  CheckCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type NotificationType =
  | "rental"
  | "new-game"
  | "discount"
  | "achievement"
  | "purchase"
  | "game-update";

type NotificationRow = {
  _id: Id<"notifications">;
  userId: Id<"profiles">;
  type: NotificationType;
  title: string;
  message: string;
  gameId?: Id<"games">;
  transactionId?: Id<"transactions">;
  isRead: boolean;
  readAt?: number;
  createdAt: number;
  meta?: any;
};

export function NotificationsDropdown({
  userId,
}: {
  userId: Id<"profiles"> | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // cerrar al click afuera
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!isOpen) return;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  const items = useQuery(
    api.notifications.getForUser,
    userId ? { userId, limit: 50 } : "skip"
  ) as NotificationRow[] | undefined;

  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    userId ? { userId } : "skip"
  ) as number | undefined;

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const clearAllForUser = useMutation(api.notifications.clearAllForUser);
  const deleteById = useMutation(api.notifications.deleteById);

  const cnt = unreadCount ?? 0;
  const list = items ?? [];

  function getIcon(t: NotificationType) {
    switch (t) {
      case "rental":
        return <Clock className="w-4 h-4 text-orange-400" />;
      case "new-game":
      case "game-update":
      case "purchase":
        return <Gamepad2 className="w-4 h-4 text-cyan-400" />;
      case "discount":
        return <Gift className="w-4 h-4 text-purple-400" />;
      case "achievement":
        return <Star className="w-4 h-4 text-yellow-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  }

  const handleMarkAll = async () => {
    if (!userId || !cnt) return;
    await markAllAsRead({ userId });
  };

  const handleClearAll = async () => {
    if (!userId || list.length === 0) return;
    await clearAllForUser({ userId });
  };

  const handleItemClick = async (n: NotificationRow) => {
    if (!userId) return;
    if (!n.isRead) {
      await markAsRead({ userId, notificationId: n._id });
    }
    const href: string | undefined =
      (typeof n.meta === "object" && n.meta?.href) || undefined;
    if (href) {
      try {
        window.location.href = href;
      } catch { }
    }
  };

  const handleDelete = async (n: NotificationRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    await deleteById({ userId, notificationId: n._id });
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Button
        variant="ghost"
        size="icon"
        title="Notificaciones"
        className={`relative text-orange-400 rounded-xl transition-all duration-200
          hover:text-amber-300 hover:bg-orange-400/10
          hover:shadow-[0_0_18px_rgba(251,146,60,0.35)]
          hover:ring-1 hover:ring-orange-400/40
          focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-orange-400/60
          ${cnt > 0 ? "animate-[pulse_2.5s_ease-in-out_infinite]" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        disabled={!userId}
        aria-expanded={isOpen}
        aria-controls="pv-notifs-popover"
      >
        <Bell className="w-5 h-5" />
        {cnt > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 p-0 text-xs bg-orange-400 text-slate-900 border-0 grid place-items-center">
            {cnt > 99 ? "99+" : cnt}
          </Badge>
        )}
      </Button>

      {/* Panel: fixed en mobile, absolute en ≥sm. SIN overflow aquí */}
      <div
        id="pv-notifs-popover"
        role="dialog"
        aria-hidden={!isOpen}
        className={[
          "fixed sm:absolute z-50",
          "inset-x-2 sm:inset-auto sm:right-0",
          "top-16 sm:top-[calc(100%+8px)]",
          "w-full sm:w-[420px] mx-auto sm:mx-0",
          "transition-all duration-200 ease-out",
          isOpen
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-1 scale-95 pointer-events-none",
        ].join(" ")}
      >
        {/* borde degradado + fondo oscuro */}
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-cyan-400/50 via-orange-400/40 to-purple-500/40">
          <div className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-300">
                  Notificaciones
                </h3>
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-400/20 text-orange-300 border border-orange-400/30">
                  {list.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {cnt > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-400 hover:text-orange-400"
                    onClick={handleMarkAll}
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck className="w-4 h-4 mr-1" />
                    Marcar
                  </Button>
                )}
                {list.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-400 hover:text-red-400"
                    onClick={handleClearAll}
                    title="Limpiar todas"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Limpiar
                  </Button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="ml-1 text-slate-400 rounded-md transition-all duration-200
                             hover:text-orange-300 hover:bg-orange-400/10
                             hover:shadow-[0_0_12px_rgba(251,146,60,0.30)]
                             hover:ring-1 hover:ring-orange-400/30
                             focus-visible:outline-none
                             focus-visible:ring-2 focus-visible:ring-orange-400/60"
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista: ÚNICO lugar con overflow */}
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-3">
              {list.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No tienes notificaciones</p>
                </div>
              ) : (
                list.map((n) => (
                  <button
                    key={n._id}
                    className={`w-full text-left px-3 py-3 mb-2 last:mb-0 rounded-xl border border-slate-800 transition-all
                      ${!n.isRead ? "bg-slate-900" : "bg-slate-900/70"}
                      hover:bg-slate-800/60 hover:shadow-[0_0_14px_rgba(251,146,60,0.15)]`}
                    onClick={() => handleItemClick(n)}
                    title={n.title}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">{getIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4
                            className={`text-sm font-semibold truncate ${!n.isRead ? "text-orange-400" : "text-cyan-300"
                              }`}
                          >
                            {n.title}
                          </h4>
                          {!n.isRead && (
                            <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mb-1 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        className="opacity-70 hover:opacity-100"
                        title="Eliminar"
                        onClick={(e) => handleDelete(n, e)}
                      >
                        <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
