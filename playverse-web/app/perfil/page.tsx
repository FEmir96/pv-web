// app/perfil/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Lock,
  Edit2,
  Save,
  X,
  Crown,
  CreditCard,
  Gamepad2,
  Calendar,
  Star,
  Trash2,
  Plus,
  Settings,
  Image as ImageIcon,
  Eye,
  UploadCloud,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/useAuthStore";

// Convex
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { api } from "@convex";

// === Refs robustas a Convex ===
const getUserByEmailRef =
  (api as any)["queries/getUserByEmail"].getUserByEmail as FunctionReference<"query">;

const getUserRentalsRef =
  (api as any)["queries/getUserRentals"].getUserRentals as FunctionReference<"query">;

const getUserPurchasesRef =
  (api as any)["queries/getUserPurchases"].getUserPurchases as FunctionReference<"query">;

const updateProfileRef =
  (api as any).auth.updateProfile as FunctionReference<"mutation">;

const changePasswordRef =
  (api as any).auth.changePassword as FunctionReference<"mutation">;

const savePaymentMethodRef =
  (api as any)["mutations/savePaymentMethod"]
    .savePaymentMethod as FunctionReference<"mutation">;

const HAS_PM_QUERY = Boolean(
  (api as any)["queries/getPaymentMethods"]?.getPaymentMethods
);
const getPaymentMethodsRef = HAS_PM_QUERY
  ? ((api as any)["queries/getPaymentMethods"]
    .getPaymentMethods as FunctionReference<"query">)
  : ((api as any)["queries/getUserByEmail"]
    .getUserByEmail as FunctionReference<"query">);

// ⬇️ NUEVO: cancelar premium
const cancelPremiumRef =
  (api as any)["mutations/cancelPremiumPlan"]
    .cancelPremiumPlan as FunctionReference<"mutation">;

const setAutoRenewRef =
  (api as any)["mutations/setAutoRenew"]?.setAutoRenew as
  | FunctionReference<"mutation">
  | undefined;

// ——— Tipos UI ———
type PaymentMethodUI = {
  id: string | number;
  brand: "visa" | "mastercard" | "amex" | "otro";
  last4: string;
  expMonth: number;
  expYear: number;
};

type RentalItemUI = {
  _id: string;
  game?: {
    _id?: string;
    slug?: string;
    title?: string;
    cover_url?: string;
  };
  gameId?: string;
  expiresAt?: number | null;
  title?: string;
  cover_url?: string;
};

type RentalWithStatus = RentalItemUI & { isExpired: boolean };

type PurchaseItemUI = {
  _id: string;
  game?: { title?: string; cover_url?: string };
  createdAt?: number;
  title?: string;
  cover_url?: string;
};

// Helpers de formateo (solo UI)
function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
function formatExpLoose(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + "/" + d.slice(2);
}

async function fileToSquareDataUrl(file: File, size = 512): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      i.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = size;
  canvas.height = size;

  const srcRatio = img.width / img.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (srcRatio > 1) {
    const newW = img.height;
    sx = (img.width - newW) / 2;
    sw = newW;
  } else if (srcRatio < 1) {
    const newH = img.width;
    sy = (img.height - newH) / 2;
    sh = newH;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export default function ProfilePage() {
  const { toast } = useToast();

  // 1) Fuente de email: NextAuth (OAuth) o tu store (email/password)
  const { data: session } = useSession();
  const storeUser = useAuthStore((s) => s.user);

  const loginEmail =
    session?.user?.email?.toLowerCase() ||
    storeUser?.email?.toLowerCase() ||
    null;

  // 2) Traemos el perfil real desde Convex
  const convexProfile = useQuery(
    getUserByEmailRef,
    loginEmail ? { email: loginEmail } : "skip"
  ) as any;

  // 3) Edición local
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");

  // Avatar + FAB + menú
  const [avatarHover, setAvatarHover] = useState(false);
  const [avatarViewOpen, setAvatarViewOpen] = useState(false);
  const [avatarUploadOpen, setAvatarUploadOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [avatarInput, setAvatarInput] = useState<string>("");

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (convexProfile) {
      setEditedName(convexProfile.name ?? "");
      setAvatarInput((convexProfile as any)?.avatarUrl || "");
    }
  }, [convexProfile]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!avatarWrapRef.current?.contains(e.target as Node)) {
        setFabOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // 4) Métodos de pago (local UI + servidor si existe la query)
  const [localMethods, setLocalMethods] = useState<PaymentMethodUI[]>([]);
  useEffect(() => {
    const raw = localStorage.getItem("pv_payment_methods_ui");
    if (raw) {
      try { setLocalMethods(JSON.parse(raw)); } catch { setLocalMethods([]); }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("pv_payment_methods_ui", JSON.stringify(localMethods));
  }, [localMethods]);

  const methodsFromDb = useQuery(
    getPaymentMethodsRef as any,
    HAS_PM_QUERY && convexProfile?._id ? { userId: convexProfile._id } : undefined
  ) as PaymentMethodUI[] | undefined;

  const displayMethods = methodsFromDb ?? localMethods;

  // 5) Guardado en Convex (perfil)
  const updateProfile = useMutation(updateProfileRef);
  const changePassword = useMutation(changePasswordRef);
  const canSave =
    isEditing &&
    convexProfile?._id &&
    (editedName.trim() !== (convexProfile?.name ?? "") ||
      avatarInput !== (convexProfile as any)?.avatarUrl);

  const handleSave = async () => {
    if (!convexProfile?._id) return;
    try {
      await updateProfile({
        userId: convexProfile._id,
        name: editedName.trim() || undefined,
        avatarUrl: avatarInput || undefined,
      });
      toast({ title: "Perfil actualizado", description: "Tus cambios se guardaron correctamente." });
      setIsEditing(false);
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message ?? "Intentá nuevamente.", variant: "destructive" });
    }
  };

  const handleCancel = () => {
    setEditedName(convexProfile?.name ?? "");
    setAvatarInput((convexProfile as any)?.avatarUrl ?? "");
    setIsEditing(false);
  };

  // 6) Alquileres y Compras
  const rentals = useQuery(
    getUserRentalsRef,
    convexProfile?._id ? { userId: convexProfile._id } : "skip"
  ) as RentalItemUI[] | undefined;

  const purchases = useQuery(
    getUserPurchasesRef,
    convexProfile?._id ? { userId: convexProfile._id } : "skip"
  ) as PurchaseItemUI[] | undefined;

  const uniquePurchases = useMemo(() => {
    const arr = Array.isArray(purchases) ? (purchases as any[]) : [];
    const seen = new Set<string>();
    const out: any[] = [];

    for (const p of arr) {
      const key = String(p?.game?._id ?? p?.gameId ?? p?.title ?? p?._id ?? "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }, [purchases]);

  const PURCHASES_PER_PAGE = 5;
  const RENTALS_PER_PAGE = 5;

  const [purchasesPage, setPurchasesPage] = useState(0);
  const [rentalsPage, setRentalsPage] = useState(0);

  const dedupedRentals = useMemo(() => {
    const arr = Array.isArray(rentals) ? (rentals as RentalItemUI[]) : [];
    const map = new Map<string, RentalItemUI>();

    const k = (item: RentalItemUI) => {
      const raw =
        item.game?._id ??
        (item as any).gameId ??
        item.game?.slug ??
        item.title ??
        item._id;
      return String(raw || "").trim().toLowerCase() || `__id:${item._id}`;
    };

    for (const item of arr) {
      const key = k(item);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        continue;
      }
      const currentExp = typeof existing.expiresAt === "number" ? existing.expiresAt : 0;
      const incomingExp = typeof item.expiresAt === "number" ? item.expiresAt : 0;
      if (incomingExp > currentExp) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }, [rentals]);

  const rentalsByStatus = useMemo(() => {
    const arr = dedupedRentals;
    const now = Date.now();
    const active: RentalWithStatus[] = [];
    const expired: RentalWithStatus[] = [];

    for (const item of arr) {
      const expiredFlag =
        typeof item.expiresAt === "number" && item.expiresAt > 0 && item.expiresAt <= now;
      const decorated: RentalWithStatus = { ...item, isExpired: expiredFlag };
      if (expiredFlag) expired.push(decorated);
      else active.push(decorated);
    }

    const sortAsc = (list: RentalWithStatus[]) =>
      list.sort((a, b) => {
        const aExp = typeof a.expiresAt === "number" ? a.expiresAt : Number.POSITIVE_INFINITY;
        const bExp = typeof b.expiresAt === "number" ? b.expiresAt : Number.POSITIVE_INFINITY;
        return aExp - bExp;
      });
    const sortDesc = (list: RentalWithStatus[]) =>
      list.sort((a, b) => {
        const aExp = typeof a.expiresAt === "number" ? a.expiresAt : Number.NEGATIVE_INFINITY;
        const bExp = typeof b.expiresAt === "number" ? b.expiresAt : Number.NEGATIVE_INFINITY;
        return bExp - aExp;
      });

    return {
      active: sortAsc(active),
      expired: sortDesc(expired),
      ordered: [...active, ...expired],
    };
  }, [dedupedRentals]);

  const activeRentals = rentalsByStatus.active;
  const expiredRentals = rentalsByStatus.expired;
  const orderedRentals = rentalsByStatus.ordered;

  const purchasesList = Array.isArray(uniquePurchases) ? uniquePurchases : [];
  const totalPurchasePages = Math.max(
    1,
    Math.ceil(purchasesList.length / PURCHASES_PER_PAGE)
  );
  const totalRentalPages = Math.max(1, Math.ceil(orderedRentals.length / RENTALS_PER_PAGE));

  const clampedPurchasesPage = Math.min(purchasesPage, totalPurchasePages - 1);
  const clampedRentalsPage = Math.min(rentalsPage, totalRentalPages - 1);

  const paginatedPurchases = purchasesList.slice(
    clampedPurchasesPage * PURCHASES_PER_PAGE,
    clampedPurchasesPage * PURCHASES_PER_PAGE + PURCHASES_PER_PAGE
  );
  const paginatedRentals = orderedRentals.slice(
    clampedRentalsPage * RENTALS_PER_PAGE,
    clampedRentalsPage * RENTALS_PER_PAGE + RENTALS_PER_PAGE
  );
  const paginatedActiveRentals = paginatedRentals.filter((item) => !item.isExpired);
  const paginatedExpiredRentals = paginatedRentals.filter((item) => item.isExpired);

  useEffect(() => {
    if (purchasesPage !== clampedPurchasesPage) {
      setPurchasesPage(clampedPurchasesPage);
    }
  }, [purchasesPage, clampedPurchasesPage]);

  useEffect(() => {
    if (rentalsPage !== clampedRentalsPage) {
      setRentalsPage(clampedRentalsPage);
    }
  }, [rentalsPage, clampedRentalsPage]);

  useEffect(() => {
    setPurchasesPage(0);
  }, [purchasesList.length]);

  useEffect(() => {
    setRentalsPage(0);
  }, [orderedRentals.length]);

  // Nombre e imagen “finales” para UI
  const displayName = useMemo(
    () => editedName || convexProfile?.name || storeUser?.name || "Usuario",
    [editedName, convexProfile?.name, storeUser?.name]
  );
  const currentAvatar =
    avatarInput ||
    (convexProfile as any)?.avatarUrl ||
    "/images/avatar-placeholder.png";

  // --- Avatar helpers ---
  const openUpload = (e?: React.MouseEvent) => { e?.stopPropagation(); setAvatarUploadOpen(true); setFabOpen(false); };
  const openView = (e?: React.MouseEvent) => { e?.stopPropagation(); setAvatarViewOpen(true); setFabOpen(false); };

  const handleFilePick = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const f = evt.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await fileToSquareDataUrl(f, 512);
      setAvatarInput(dataUrl);
      if (convexProfile?._id) {
        await updateProfile({ userId: convexProfile._id, avatarUrl: dataUrl });
        toast({ title: "Foto actualizada", description: "Tu nueva foto de perfil se guardó correctamente." });
      }
      setAvatarUploadOpen(false);
    } catch (err: any) {
      toast({ title: "Error al procesar la imagen", description: err?.message ?? "Probá con otro archivo.", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const diceBearSuggestions = useMemo(() => {
    const seed = (loginEmail || displayName || "playverse").replace(/[^a-z0-9]/gi, "");
    return Array.from({ length: 6 }).map((_, i) => {
      const s = `${seed}-${i + 1}`;
      return `https://api.dicebear.com/8.x/bottts-neutral/png?seed=${encodeURIComponent(s)}&radius=50&format=png`;
    });
  }, [loginEmail, displayName]);

  const useSuggestion = async (url: string) => {
    try {
      setAvatarInput(url);
      if (convexProfile?._id) {
        await updateProfile({ userId: convexProfile._id, avatarUrl: url });
        toast({ title: "Foto actualizada", description: "Se aplicó el avatar sugerido." });
      }
      setAvatarUploadOpen(false);
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message ?? "Intentá nuevamente.", variant: "destructive" });
    }
  };

  // ——— Modal "Agregar método de pago" ———
  const [payOpen, setPayOpen] = useState(false);
  const [pmBrand, setPmBrand] = useState<PaymentMethodUI["brand"]>("visa");
  const [pmNumber, setPmNumber] = useState("");
  const [pmExp, setPmExp] = useState(""); // "MM/YY"
  const [pmCvv, setPmCvv] = useState("");

  const savePaymentMethod = useMutation(savePaymentMethodRef);

  // delete payment method (Convex)
  const deletePaymentMethodRef = (api as any)["mutations/deletePaymentMethod"]?.deletePaymentMethod as FunctionReference<"mutation"> | undefined;
  const deletePaymentMethod = deletePaymentMethodRef ? useMutation(deletePaymentMethodRef) : null;

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | number | null>(null);
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removedIds, setRemovedIds] = useState<Array<string | number>>([]);

  function maskCard(num: string) {
    const clean = num.replace(/\D/g, "");
    if (clean.length < 4) return "•••• •••• •••• " + clean;
    const last4 = clean.slice(-4);
    return "•••• •••• •••• " + last4;
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convexProfile?._id) {
      toast({ title: "No se pudo guardar", description: "No se encontró el perfil del usuario.", variant: "destructive" });
      return;
    }

    try {
      await savePaymentMethod({
        userId: convexProfile._id,
        fullNumber: pmNumber,
        exp: pmExp,
        cvv: pmCvv,
        brand: pmBrand,
      });

      const clean = pmNumber.replace(/\D/g, "");
      const last4 = clean.slice(-4);
      const [mm, yy] = pmExp.split("/");
      const uiItem: PaymentMethodUI = {
        id: Date.now(),
        brand: pmBrand,
        last4,
        expMonth: Number(mm),
        expYear: 2000 + Number(yy),
      };
      setLocalMethods((arr) => [uiItem, ...arr]);

      setPayOpen(false);
      setPmBrand("visa"); setPmNumber(""); setPmExp(""); setPmCvv("");

      toast({
        title: "Método agregado",
        description: "Se guardó tu tarjeta de forma segura. Mostramos solo últimos 4 dígitos.",
      });
    } catch (err: any) {
      toast({
        title: "No se pudo guardar",
        description: err?.message ?? "Revisá los datos e intentá otra vez. Para pruebas usá 4111 1111 1111 1111 o 5555 5555 5555 4444.",
        variant: "destructive",
      });
    }
  };

  const removeLocalMethod = (id: number | string) => {
    setLocalMethods((arr) => arr.filter((m) => m.id !== id));
  };

  // Badge de rol (free/premium/admin)
  const role = convexProfile?.role ?? "free";
  const roleStyle =
    role === "admin"
      ? "bg-fuchsia-700/80 text-white ring-1 ring-fuchsia-400/40"
      : role === "premium"
        ? "bg-orange-400 text-slate-900"
        : "bg-slate-600 text-white";
  const roleIcon =
    role === "admin" ? <ShieldAlert className="w-3 h-3 mr-1" /> : <Crown className="w-3 h-3 mr-1" />;
  const roleLabel = role === "admin" ? "Admin" : role === "premium" ? "Premium" : "Free";
  const premiumPlan = (convexProfile as any)?.premiumPlan;
  const isLifetimePlan = premiumPlan === "lifetime";
  const premiumAutoRenew = isLifetimePlan ? false : (convexProfile as any)?.premiumAutoRenew !== false;
  const trialEndsAt = typeof (convexProfile as any)?.trialEndsAt === "number" ? (convexProfile as any).trialEndsAt : null;
  const trialActive = Boolean(trialEndsAt && trialEndsAt > Date.now());
  const trialEndLabel = trialActive ? new Date(trialEndsAt as number).toLocaleDateString() : null;
  const cancelAutoLabel = trialActive ? "Cancelar prueba gratuita" : "Cancelar renovacion automatica";
  const reactivateAutoLabel = trialActive ? "Reactivar prueba gratuita" : "Reactivar renovacion automatica";

  // ⬇️ NUEVO: cancelación
  const cancelPremium = useMutation(cancelPremiumRef);
  const setAutoRenew = setAutoRenewRef ? useMutation(setAutoRenewRef) : null;
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);

  const performAutoRenewMutation = async (nextValue: boolean) => {
    if (!convexProfile?._id) {
      throw new Error("No se encontró el perfil del usuario.");
    }
    if (setAutoRenew) {
      return (setAutoRenew as any)({
        userId: convexProfile._id,
        autoRenew: nextValue,
        reason: nextValue ? "user_reactivate" : "user_cancel",
      });
    }
    if (!nextValue) {
      return (cancelPremium as any)({
        userId: convexProfile._id,
        reason: "user_cancel",
      });
    }
    throw new Error("No se puede reactivar la renovacion automatica en este entorno.");
  };

  const handleReactivateAutoRenew = async () => {
    setAutoRenewLoading(true);
    try {
      await performAutoRenewMutation(true);
      toast({
        title: "Renovacion automatica activada",
        description: "Tu proxima factura se generara automaticamente.",
      });
      setReactivateModalOpen(false);
    } catch (err: any) {
      toast({
        title: "No se pudo reactivar",
        description: err?.message ?? "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setAutoRenewLoading(false);
    }
  };

  const resetPasswordForm = () => {
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
  };

  const openPasswordModal = () => {
    resetPasswordForm();
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) return;
    setPasswordModalOpen(false);
    resetPasswordForm();
  };

  const handlePasswordSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!convexProfile?._id) {
      toast({
        title: "No encontramos tu perfil",
        description: "Volve a iniciar sesion e intentalo de nuevo.",
        variant: "destructive",
      });
      return;
    }

    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      toast({
        title: "Completa los campos",
        description: "Necesitamos la clave actual y la nueva.",
        variant: "destructive",
      });
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Revisa la confirmacion e intentalo de nuevo.",
        variant: "destructive",
      });
      return;
    }

    if (newPasswordInput.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "Necesita al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const result = await (changePassword as any)({
        userId: convexProfile._id,
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
      });

      if (!result?.ok) {
        const errorMap: Record<string, string> = {
          invalid_current: "La clave actual no coincide.",
          weak_password: "La nueva contraseña necesita al menos 6 caracteres.",
          same_password: "Usa una contraseña diferente a la actual.",
          no_password: "Tu cuenta no tiene contraseña local.",
        };
        const message =
          errorMap[result?.error as keyof typeof errorMap] ??
          "No se pudo cambiar la contraseña.";
        toast({ title: "No se pudo cambiar", description: message, variant: "destructive" });
        return;
      }

      toast({
        title: "Contraseña actualizada",
        description: "Ya podes usar la nueva clave.",
      });
      setPasswordModalOpen(false);
      resetPasswordForm();
    } catch (err: any) {
      toast({
        title: "No se pudo cambiar",
        description: err?.message ?? "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // ⬇️ NUEVO: aviso por toast cuando está por vencer o ya venció (solo UI)
  useEffect(() => {
    const exp = (convexProfile as any)?.premiumExpiresAt as number | undefined;
    if (!exp) return;

    const showSoonToast = () => {
      const msLeft = exp - Date.now();
      if (msLeft <= 0) {
        toast({
          title: "Tu Premium venció",
          description: "Tu cuenta puede volver a Free en breve.",
          variant: "destructive",
        });
      } else if (msLeft <= 3 * 24 * 60 * 60 * 1000) {
        toast({
          title: "Tu Premium vence pronto",
          description: `Vence el ${new Date(exp).toLocaleDateString()}`,
        });
      }
    };

    showSoonToast();
    const id = setInterval(showSoonToast, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [convexProfile?._id, (convexProfile as any)?.premiumExpiresAt, toast]);

  // === UI ===
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex items-center gap-6 mb-6">
            {/* Wrapper para no recortar el menú */}
            <div
              ref={avatarWrapRef}
              className="relative inline-block group"
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
            >
              {/* Avatar circular */}
              <div className="w-28 h-28 rounded-full overflow-hidden border border-slate-700 relative">
                <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" draggable={false} />
                {/* FAB centrado (aparece en hover) */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFabOpen((s) => !s); }}
                  className={`absolute inset-0 m-auto h-12 w-12 rounded-full grid place-items-center
                    bg-[#ffb900] text-slate-900 ring-2 ring-white/40 shadow
                    transition-opacity duration-150
                    ${avatarHover ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  title="Opciones de foto"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Menú fuera del círculo */}
              {fabOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+10px)] z-20">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={openView}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      <Eye className="w-4 h-4" /> Ver foto
                    </button>
                    <button
                      type="button"
                      onClick={openUpload}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      <UploadCloud className="w-4 h-4" /> Cambiar foto
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-orange-400 mb-2">{displayName}</h1>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleStyle}`}>
                  {roleIcon}
                  {roleLabel}
                </span>
                {role === "premium" && (convexProfile as any)?.premiumExpiresAt && (convexProfile as any)?.premiumPlan !== "lifetime" ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-slate-700 text-slate-200">
                    Vence el {new Date((convexProfile as any).premiumExpiresAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* First Row - Main Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Personal Information */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-orange-400">Información Personal</CardTitle>

                {!isEditing ? (
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="text-orange-400 hover:text-orange-300">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={!canSave} className="bg-orange-400 hover:bg-orange-500 text-slate-900">
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancel} className="text-slate-400">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-300">Nombre de usuario</Label>
                  {isEditing ? (
                    <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="bg-slate-700 border-slate-600 text-white mt-1" />
                  ) : (
                    <p className="text-white mt-1">{displayName}</p>
                  )}
                </div>

                <div>
                  <Label className="text-slate-300">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <p className="text-slate-400">{loginEmail ?? "email@ejemplo.com"}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Contraseña</Label>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <p className="text-slate-400">••••••••</p>
                    </div>
                    <Button
                      type="button"
                      onClick={openPasswordModal}
                      className="bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-1.5 rounded-full shadow focus-visible:ring-2 focus-visible:ring-amber-300"
                    >
                      Cambiar contraseña
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <div>
                    <Label className="text-slate-300">URL de avatar</Label>
                    <Input
                      placeholder="https://... (opcional)"
                      value={avatarInput}
                      onChange={(e) => setAvatarInput(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subscription Management */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-orange-400">Suscripción Premium</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {role === "premium" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">Plan Premium</p>
                        <p className="text-slate-400 text-sm">
                          Renovacion automatica {isLifetimePlan ? "no aplica (lifetime)" : premiumAutoRenew ? "activa" : "desactivada"}
                        </p>
                        {(convexProfile as any)?.premiumExpiresAt && (convexProfile as any)?.premiumPlan !== "lifetime" ? (
                          <p className="text-slate-400 text-xs mt-1">
                            Vence el {new Date((convexProfile as any).premiumExpiresAt).toLocaleDateString()}
                          </p>
                        ) : null}
                        {trialActive && trialEndLabel && (
                          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-100 text-sm p-3">
                            Prueba gratuita activa hasta {trialEndLabel}. Si no cancelas antes de esa fecha, cobraremos el plan seleccionado de forma automatica.
                          </div>
                        )}
                      </div>
                      <Badge className="bg-orange-400 text-slate-900">Activo</Badge>
                    </div>
                    {!isLifetimePlan ? (
                      <>
                        <Separator className="bg-slate-700" />
                        {premiumAutoRenew ? (
                          <Button
                            variant="outline"
                            onClick={() => setConfirmCancelOpen(true)}
                            className="w-full border-red-500 text-red-400 hover:bg-red-500 hover:text-white bg-transparent"
                          >
                            {cancelAutoLabel}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setReactivateModalOpen(true)}
                            disabled={autoRenewLoading}
                            className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900 disabled:opacity-70"
                          >
                            {autoRenewLoading ? "Reactivando..." : reactivateAutoLabel}
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-400 text-xs">Este plan lifetime no necesita renovacion.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-slate-300 text-sm">
                      Pasate a Premium para desbloquear la biblioteca completa, sin anuncios y con descuentos.
                    </p>
                    <Link
                      href="/premium"
                    >
                      <Button className="w-full bg-orange-400 hover:bg-orange-500 text-slate-900">
                        Suscribirme ahora
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-orange-400">Métodos de Pago</CardTitle>
                <Button size="icon" variant="ghost" onClick={() => setPayOpen(true)} className="text-orange-400 hover:text-orange-300" title="Agregar método">
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayMethods && displayMethods.length > 0 ? (
                  // hide any removed ids optimistically
                  displayMethods.filter((mm) => !removedIds.includes(mm.id)).map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-white text-sm">{m.brand.toUpperCase()} •••• {m.last4}</p>
                          <p className="text-slate-400 text-xs">
                            Expira {String(m.expMonth).padStart(2, "0")}/{String(m.expYear).slice(-2)}
                          </p>
                        </div>
                      </div>
                      {methodsFromDb ? (
                        // server-backed method: open confirmation modal
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPendingDeleteId(m.id);
                            setPendingDeleteLabel(`${m.brand.toUpperCase()} •••• ${m.last4}`);
                            setDeleteModalOpen(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => removeLocalMethod(m.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-sm">No agregaste métodos todavía.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Second Row - Games Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Purchased Games */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-orange-400 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  Comprados
                </CardTitle>
                {/* 👉 Enlaza a /mis-juegos?tab=purchases con estilo amable (sin hover blanco) */}
                <Link href="/mis-juegos?tab=purchases" prefetch>
                  <Button
                    size="sm"
                    className="
                      rounded-full bg-transparent
                      text-amber-300 border border-amber-300/30
                      hover:bg-amber-400/15 hover:text-amber-200
                    "
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Administrar juegos
                  </Button>
                </Link>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {paginatedPurchases.map((p) => {
                    const title = p.game?.title || p.title || "Juego";
                    const cover = p.game?.cover_url || p.cover_url || "/placeholder.svg";
                    const when =
                      typeof p.createdAt === "number"
                        ? new Date(p.createdAt).toLocaleDateString()
                        : null;

                    return (
                      <div key={p._id} className="bg-slate-700 rounded-lg p-4 flex items-center gap-4">
                        <img src={cover} alt={title} className="w-16 h-16 rounded-lg object-cover" />
                        <div className="flex-1">
                          <h3 className="text-white font-medium">{title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 text-sm">
                              {when ? `Comprado el ${when}` : `Compra registrada`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {purchasesList.length === 0 && (
                    <p className="text-slate-400 text-sm">Aun no hay compras registradas.</p>
                  )}
                </div>
                {totalPurchasePages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPurchasesPage((prev) => Math.max(prev - 1, 0))}
                      disabled={clampedPurchasesPage === 0}
                      className="text-slate-300 hover:text-white"
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-slate-400">
                      Pagina {clampedPurchasesPage + 1} de {totalPurchasePages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPurchasesPage((prev) =>
                          Math.min(prev + 1, totalPurchasePages - 1)
                        )
                      }
                      disabled={clampedPurchasesPage >= totalPurchasePages - 1}
                      className="text-slate-300 hover:text-white"
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rented Games */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-orange-400 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Alquilados
                </CardTitle>
                {/* 👉 Enlaza a /mis-juegos?tab=rentals con estilo amable (sin hover blanco) */}
                <Link href="/mis-juegos?tab=rentals" prefetch>
                  <Button
                    size="sm"
                    className="
                      rounded-full bg-transparent
                      text-sky-300 border border-sky-400/30
                      hover:bg-sky-400/15 hover:text-white
                    "
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Administrar juegos
                  </Button>
                </Link>
              </CardHeader>

              <CardContent>
                <div className="space-y-5">
                  {activeRentals.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Alquileres activos ({activeRentals.length})
                        </p>
                      </div>
                      {paginatedActiveRentals.map((r) => {
                        const title = r.game?.title || r.title || "Juego";
                        const cover = r.game?.cover_url || r.cover_url || "/placeholder.svg";
                        const exp =
                          typeof r.expiresAt === "number"
                            ? new Date(r.expiresAt).toLocaleDateString()
                            : null;

                        return (
                          <div key={r._id} className="bg-slate-700 rounded-lg p-4 flex items-center gap-4">
                            <img src={cover} alt={title} className="w-16 h-16 rounded-lg object-cover" />
                            <div className="flex-1">
                              <h3 className="text-white font-medium">{title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-300 text-sm">
                                  {exp ? `Expira el ${exp}` : `Expira pronto`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {paginatedActiveRentals.length === 0 && (
                        <p className="text-slate-500 text-sm">No hay alquileres activos en esta pagina.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">Aun no tenes alquileres activos.</p>
                  )}

                  {expiredRentals.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-slate-700/60">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Alquileres vencidos ({expiredRentals.length})
                        </p>
                      </div>
                      {paginatedExpiredRentals.map((r) => {
                        const title = r.game?.title || r.title || "Juego";
                        const cover = r.game?.cover_url || r.cover_url || "/placeholder.svg";
                        const exp =
                          typeof r.expiresAt === "number"
                            ? new Date(r.expiresAt).toLocaleDateString()
                            : null;

                        return (
                          <div
                            key={`${r._id}-expired`}
                            className="bg-slate-700/50 rounded-lg p-4 flex items-center gap-4 border border-slate-700/60 text-slate-400"
                          >
                            <img
                              src={cover}
                              alt={title}
                              className="w-16 h-16 rounded-lg object-cover opacity-60 grayscale"
                            />
                            <div className="flex-1">
                              <h3 className="text-slate-300 font-medium">{title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                <span className="text-slate-400 text-sm">
                                  {exp ? `Vencio el ${exp}` : `Vencio recientemente`}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {paginatedExpiredRentals.length === 0 && (
                        <p className="text-slate-500 text-sm">No hay alquileres vencidos en esta pagina.</p>
                      )}
                    </div>
                  )}
                </div>

                {totalRentalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRentalsPage((prev) => Math.max(prev - 1, 0))}
                      disabled={clampedRentalsPage === 0}
                      className="text-slate-300 hover:text-white"
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-slate-400">
                      Pagina {clampedRentalsPage + 1} de {totalRentalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRentalsPage((prev) =>
                          Math.min(prev + 1, totalRentalPages - 1)
                        )
                      }
                      disabled={clampedRentalsPage >= totalRentalPages - 1}
                      className="text-slate-300 hover:text-white"
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={closePasswordModal}
        >
          <form
            onSubmit={handlePasswordSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-orange-400 font-semibold">Cambiar contraseña</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-slate-300"
                onClick={closePasswordModal}
                disabled={changingPassword}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-sm text-slate-400">
              Ingresa la clave actual y elegi una nueva. Por seguridad debe ser distinta a la anterior.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">Clave actual</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  disabled={changingPassword}
                />
              </div>
              <div>
                <Label className="text-slate-300">Nueva contraseña</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  disabled={changingPassword}
                />
              </div>
              <div>
                <Label className="text-slate-300">Confirmar nueva contraseña</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white mt-1"
                  disabled={changingPassword}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closePasswordModal}
                disabled={changingPassword}
                className="border-amber-500/60 text-amber-400 bg-transparent hover:bg-amber-400"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={changingPassword}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900"
              >
                {changingPassword ? "Guardando..." : "Aceptar"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* === MODAL: Ver foto === */}
      {avatarViewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setAvatarViewOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-orange-400 font-semibold">Foto de perfil</h3>
              <Button variant="ghost" size="icon" className="text-slate-300" onClick={() => setAvatarViewOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center justify-center">
              <img src={currentAvatar} alt="Avatar" className="max-h:[60vh] max-w-full rounded-lg object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Cambiar foto === */}
      {avatarUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setAvatarUploadOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-orange-400 font-semibold">Cambiar foto</h3>
              <Button variant="ghost" size="icon" className="text-slate-300" onClick={() => setAvatarUploadOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePick} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} className="bg-orange-400 hover:bg-orange-500 text-slate-900">
                  Subir desde tu PC
                </Button>
              </div>

              <Separator className="bg-slate-700" />

              <div>
                <p className="text-slate-300 text-sm mb-2">Sugerencias rápidas</p>
                <div className="grid grid-cols-6 gap-2">
                  {diceBearSuggestions.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => useSuggestion(u)}
                      className="rounded-full overflow-hidden border border-slate-700 hover:ring-2 hover:ring-orange-400 transition"
                      title="Usar este avatar"
                    >
                      <img src={u} alt="Sugerencia de avatar" className="w-12 h-12 object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAvatarUploadOpen(false)} className="border-slate-600 text-slate-300 bg-transparent">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Confirmar eliminación de método de pago === */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { if (!deleting) setDeleteModalOpen(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-orange-400 font-semibold">Eliminar método de pago</h3>
              <Button variant="ghost" size="icon" className="text-slate-300" onClick={() => { if (!deleting) setDeleteModalOpen(false); }}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-slate-300 mb-4">¿Querés eliminar {pendingDeleteLabel ?? "este método de pago"}? Esta acción no se puede deshacer.</p>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} className="text-slate-300">Cancelar</Button>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={async () => {
                  if (!deletePaymentMethod || pendingDeleteId == null) return;
                  setDeleting(true);
                  try {
                    await deletePaymentMethod({ id: pendingDeleteId } as any);
                    // optimistically hide
                    setRemovedIds((arr) => [...arr, pendingDeleteId]);
                    toast({ title: "Método eliminado", description: "Se quitó el método de pago." });
                    setDeleteModalOpen(false);
                    setPendingDeleteId(null);
                    setPendingDeleteLabel(null);
                  } catch (err: any) {
                    toast({ title: "No se pudo eliminar", description: err?.message ?? "Intentá nuevamente.", variant: "destructive" });
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Confirmar cancelación de renovacion automatica === */}
      {confirmCancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { if (!cancelling) setConfirmCancelOpen(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-orange-400 font-semibold">{trialActive ? "Cancelar prueba gratuita" : "Cancelar renovacion automatica"}</h3>
              <Button variant="ghost" size="icon" className="text-slate-300" onClick={() => { if (!cancelling) setConfirmCancelOpen(false); }}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-slate-300 mb-4">
              {trialActive
                ? "Si cancelas ahora, tu cuenta volvera a Free de inmediato y no se realizara ningun cobro."
                : "Cumplida la fecha de expiracion, perderas el acceso a los beneficios de PlayVerse Premium y no se renovara automaticamente. Seguro que deseas continuar?"}
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmCancelOpen(false)} className="text-slate-300">Cancelar</Button>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={async () => {
                  setCancelling(true);
                  try {
                    await performAutoRenewMutation(false);
                    toast({
                      title: trialActive ? "Prueba cancelada" : "Renovacion automatica cancelada",
                      description: trialActive
                        ? "Volviste a Free. Si cambias de opinion podes suscribirte cuando quieras."
                        : "Tu cuenta mantiene el acceso hasta el vencimiento actual.",
                    });
                    setConfirmCancelOpen(false);
                  } catch (e: any) {
                    toast({
                      title: "No se pudo cancelar",
                      description: e?.message ?? "Intenta nuevamente.",
                      variant: "destructive",
                    });
                  } finally {
                    setCancelling(false);
                  }
                }}
                disabled={cancelling}
              >
                {cancelling ? "Cancelando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Confirmar reactivacion de renovacion automatica === */}
      {reactivateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { if (!autoRenewLoading) setReactivateModalOpen(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-orange-400 font-semibold">{reactivateAutoLabel}</h3>
              <Button variant="ghost" size="icon" className="text-slate-300" onClick={() => { if (!autoRenewLoading) setReactivateModalOpen(false); }}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-slate-300 mb-4">
              {trialActive
                ? "Tu prueba volvera a estar activa y programaremos el cobro del plan mensual dentro de 7 dias."
                : "Vamos a volver a facturar tu plan en forma automatica al renovar. Estas seguro de continuar?"}
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setReactivateModalOpen(false)} className="text-slate-300" disabled={autoRenewLoading}>
                Cancelar
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-slate-900"
                onClick={handleReactivateAutoRenew}
                disabled={autoRenewLoading}
              >
                {autoRenewLoading ? "Reactivando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Agregar método de pago === */}
      {payOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPayOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handlePaymentSubmit} className="bg-slate-900 border border-slate-700 rounded-xl p-5 w/full max-w-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-orange-400 font-semibold">Agregar método de pago</h3>
              <Button type="button" variant="ghost" size="icon" className="text-slate-300" onClick={() => setPayOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-slate-300 mb-1.5">Marca</Label>
                <select
                  value={pmBrand}
                  onChange={(e) => setPmBrand(e.target.value as PaymentMethodUI["brand"])}
                  className="mt-1 w-full rounded-md bg-slate-700 border border-slate-600 text-white px-2 py-2"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <Label className="text-slate-300 mb-2">Número de tarjeta</Label>
                <Input
                  value={pmNumber}
                  onChange={(e) => setPmNumber(formatCardNumber(e.target.value))}
                  placeholder="4111 1111 1111 1111"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">Se guarda un hash, no almacenamos el número completo.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 mb-2">Vencimiento (MM/YY)</Label>
                  <Input
                    value={pmExp}
                    onChange={(e) => setPmExp(formatExpLoose(e.target.value))}
                    placeholder="12/26"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    required
                  />
                </div>
                <div>
                  <Label className="text-slate-300 mb-2">CVV</Label>
                  <Input
                    value={pmCvv}
                    onChange={(e) => setPmCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="123"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    required
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-700 my-4" />

            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                {pmNumber ? maskCard(pmNumber) : "•••• •••• •••• ••••"}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setPayOpen(false)} className="border-slate-600 text-slate-300 bg-transparent">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-orange-400 hover:bg-orange-500 text-slate-900">
                  Guardar
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
