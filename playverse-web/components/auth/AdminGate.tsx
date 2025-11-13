"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = { children: ReactNode; fallback?: ReactNode };

export default function AdminGate({ children, fallback }: Props) {
  const { status, data } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = (data?.user as any)?.role;

  const isLoading = useMemo(() => {
    if (status === "loading") return true;
    if (status === "authenticated" && typeof role === "undefined") return true;
    return false;
  }, [status, role]);

  useEffect(() => {
    if (isLoading) return;

    if (status === "unauthenticated") {
      const next = pathname + (searchParams?.toString() ? `?${searchParams}` : "");
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (status === "authenticated" && role !== "admin") {
      router.replace("/");
    }
  }, [isLoading, status, role, router, pathname, searchParams]);

  if (isLoading) return <>{fallback ?? null}</>;
  if (status !== "authenticated" || role !== "admin") return null;

  return <>{children}</>;
}
