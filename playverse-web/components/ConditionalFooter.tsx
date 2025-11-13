"use client"

import { usePathname } from "next/navigation"
import { Footer } from "./footer"

export function ConditionalFooter() {
  const pathname = usePathname()

  const hideFooter =
    pathname?.startsWith("/auth/login") ||
    pathname?.startsWith("/auth/register") ||
    pathname?.startsWith("/auth/forgot-password") ||
    pathname?.startsWith("/terms") ||
    pathname?.startsWith("/admin") 

  if (hideFooter) {
    return null
  }

  return <Footer />
}
