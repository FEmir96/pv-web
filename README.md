# PlayVerse Web 🎮🌐

Front web de PlayVerse construido con Next.js (App Router) + Convex. Muestra catálogo, fichas de juego, checkout premium/compra/alquiler, leaderboard y modo de juego embebido con autenticación (Google, Microsoft y credenciales) vía NextAuth.

## 🚀 Cómo levantarlo local
1) Variables en `playverse-web/.env.local` (hay una de ejemplo):  
   - Convex: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`.  
   - Auth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `MICROSOFT_TENANT_ID`.  
   - Embeds opcionales para juegos: `NEXT_PUBLIC_TETRIS_URL`, `NEXT_PUBLIC_ARENA_URL` (y sus `*_EMBED_URL`).  
2) Instala y corre el front:  
   ```bash
   cd playverse-web
   npm install
   npm run dev
   ```  
   Luego abre http://localhost:3000 🌟.
3) Backend Convex (opcional 👾): desde la raíz del repo podés hacer `npm run dev:convex` si querés usar un deployment local en lugar del cloud.

## 🧭 Estructura de carpetas
- `playverse-web/app/`: rutas de App Router (home, catálogo, juego/[id], play/* embebido, premium, mis-juegos, leaderboard, contacto) y API routes (`api/auth/[...nextauth]`).
- `playverse-web/components/`: UI reutilizable (header/footer, rails de juegos destacados/free/upcoming, dropdowns de notificaciones/favoritos/carrito 🪙, reproductor de trailers, `ScoreBridge`, tooling admin, componentes `ui/` de shadcn+Radix).
- `playverse-web/lib/`: clientes Convex, store de auth con Zustand, validaciones de checkout, utilidades de gamepad y helpers varios.
- `playverse-web/hooks/`: hooks de soporte (`use-mobile`, toasts).
- `playverse-web/styles/` y `public/`: estilos globales y assets (logos, iconografía retro 🌹).
- `playverse-web/convex/_generated/`: tipos/cliente sincronizados con el backend Convex.
- `convex/` en la raíz del repo: acciones, mutaciones, queries y cron jobs que alimentan la app web/móvil.
- `scripts/`: utilidades de mantenimiento (ej. clon de datos de Convex dev→prod).

## 🌟 Dependencias principales
- Next.js 14 (App Router) + React 18.
- NextAuth para OAuth/credenciales y middleware de sesión.
- Convex client para datos en tiempo real y mutaciones.
- Tailwind CSS 4 + shadcn/ui + Radix UI; utilidades `clsx`, `class-variance-authority`, `tailwind-merge`.
- Zustand para estado de carrito/favoritos; `react-hook-form` + `zod` para formularios.
- UI/extras: `framer-motion`, `embla-carousel-react`, `lucide-react`, `recharts`, `sonner`, `date-fns`.
