"use client";

import React from "react";
import { useSession } from "next-auth/react";
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
// Dialog components removed: newsletter feature deprecated

export function Footer() {
  const { data: session } = useSession();
  // no-op: newsletter feature removed

  return (
    <footer className="bg-slate-900 border-t border-slate-700 mt-16">
      <div className="container mx-auto px-4 py-12">
  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
  {/* Left spacer to center columns on md+ */}
  <div className="hidden md:block md:col-span-1" />

  {/* Logo and Description */}
  <div className="space-y-4 md:col-span-3">
            <Link href="/" className="flex items-center">
              <Image src="/images/playverse-logo.png" alt="PlayVerse" width={80} height={40} className="h-10 w-auto" />
            </Link>
            <p className="text-slate-400 text-sm">
              Tu portal al universo de los juegos. Alquila o compra, ¡La diversión te espera!
            </p>
            {/* Social Icons */}
            <div className="flex space-x-4">
              {/* YouTube */}
              <Link
                href="#"
                className="w-8 h-8 bg-slate-800 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors group"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4 text-slate-400 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </Link>

              {/* Facebook */}
              <Link
                href="#"
                className="w-8 h-8 bg-slate-800 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors group"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4 text-slate-400 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </Link>

              {/* X (Twitter) */}
              <Link
                href="#"
                className="w-8 h-8 bg-slate-800 hover:bg-black rounded-full flex items-center justify-center transition-colors group"
                aria-label="X (Twitter)"
              >
                <svg className="w-4 h-4 text-slate-400 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.508 11.24H16.16l-5.214-6.82-5.966 6.82H1.672l7.735-8.85L1.17 2.25h7.06l4.713 6.231z" />
                </svg>
              </Link>

              {/* Instagram */}
              <Link
                href="#"
                className="w-8 h-8 bg-slate-800 hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 rounded-full flex items-center justify-center transition-all group"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4 text-slate-400 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zm8.75 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Navigation */}
          <div className="md:col-span-4 md:justify-self-center">
            <h3 className="text-white font-medium mb-4">Navegación</h3>
            <div className="flex flex-col space-y-2 items-start">
              <Link href="/" className="inline text-slate-400 hover:text-orange-400 text-sm">
                Inicio
              </Link>
              <Link href="/catalogo" className="inline text-slate-400 hover:text-orange-400 text-sm">
                Catálogo
              </Link>
              <Link href="/mis-juegos" className="inline text-slate-400 hover:text-orange-400 text-sm">
                Mis juegos
              </Link>
              <Link href="/premium" className="inline text-slate-400 hover:text-orange-400 text-sm">
                Házte premium!
              </Link>
            </div>
          </div>

          {/* Support */}
          <div className="md:col-span-2 md:justify-self-center">
            <h3 className="text-white font-medium mb-4">Soporte</h3>
            <div className="flex flex-col space-y-2 items-start">
              <Link href="/contacto" className="inline text-slate-400 hover:text-orange-400 text-sm">
                Preguntas frecuentes
              </Link>
              <Link href="/contacto" className="inline text-slate-400 hover:text-orange-400 text-sm">
                Contacto
              </Link>
              <Link href="/terms" className="inline text-slate-400 hover:text-orange-400 text-sm">
                Términos y condiciones
              </Link>
            </div>
          </div>

          {/* Right spacer to center columns on md+ */}
          <div className="hidden md:block md:col-span-2" />
          

        </div>
        {/* Copyright */}
        <div className="border-t border-slate-700 mt-8 pt-8">
          <p className="text-slate-400 text-sm text-center">© 2025 PlayVerse. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
