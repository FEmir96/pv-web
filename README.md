# PlayVerse Web 🎮🌐

Front web de PlayVerse (Next.js App Router) que muestra catalogo, fichas de juego, checkout (premium/compra/alquiler), leaderboard y modo de juego embebido. Autenticacion con NextAuth (Google, Microsoft y credenciales) y datos en tiempo real via Convex.

## 🧭 Que hay en este repo
- `playverse-web/`: app Next.js (fuente principal).
- `convex/`: backend Convex compartido (acciones, mutaciones, queries, crons). Si apuntas al deployment remoto no es necesario levantarlo local.
- `scripts/`: utilidades (ej. clonar datos de Convex).

## 🛠️ Prerrequisitos
- Node.js 18+ y npm.
- Credenciales OAuth de Google y Microsoft/Entra (para pruebas locales de login).
- Opcional: Convex CLI instalada (`npm i -g convex`) si quieres levantar backend local.

## 🔑 Variables de entorno (poner en `playverse-web/.env.local`)
Obligatorias para login y datos:
- `NEXT_PUBLIC_CONVEX_URL` y/o `CONVEX_URL`, `CONVEX_DEPLOYMENT`: apuntan al deployment Convex (local o cloud).
- `NEXTAUTH_URL`: URL base de la app (ej. `http://localhost:3000`).
- `NEXTAUTH_SECRET`: secreto de NextAuth.
- OAuth Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- OAuth Microsoft/Entra: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (o sus alias `AZURE_AD_*`).
- Opcionales para juegos embebidos: `NEXT_PUBLIC_TETRIS_URL`, `NEXT_PUBLIC_ARENA_URL` y sus `*_EMBED_URL`.

Ejemplo rapido:
```env
NEXT_PUBLIC_CONVEX_URL=https://<tu-convex>.convex.cloud
CONVEX_URL=https://<tu-convex>.convex.cloud
CONVEX_DEPLOYMENT=dev:<tu-deployment>
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=super-secret
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxx
MICROSOFT_TENANT_ID=common
NEXT_PUBLIC_TETRIS_URL=https://playverse-demo-games.vercel.app/tetris
NEXT_PUBLIC_TETRIS_EMBED_URL=https://playverse-demo-games.vercel.app/tetris
```
- Los valores reales (client IDs, secretos) van en tu `.env.local` privado; no se suben al repo. Copia los que te comparta el equipo.

## 🚀 Como levantarlo local
1) `cd playverse-web`
2) `npm install`
3) Revisa/crea `playverse-web/.env.local` con las claves de arriba (sin ellas el login OAuth fallara).
4) Corre el front: `npm run dev` y abre http://localhost:3000
5) Backend opcional 👾: desde la raiz del repo (`pv-web/`) puedes levantar Convex local con `npm run dev:convex` si quieres probar contra tu propia instancia en vez del deployment cloud.

## 🧱 Estructura clave
- `app/`: rutas de App Router (home, catalogo, juego/[id], play/* embebido, premium, mis-juegos, leaderboard, contacto) y API routes (`api/auth/[...nextauth]`).
- `components/`: UI reusable (header/footer, rails destacados/free/upcoming, dropdowns de notificaciones/favoritos/carrito 🪙, reproductor de trailers, `ScoreBridge`, admin tooling, componentes `ui/` de shadcn+Radix).
- `lib/`: cliente Convex, store de auth con Zustand, validaciones de checkout, utilidades de gamepad y helpers.
- `hooks/`: hooks de soporte (`use-mobile`, toasts).
- `styles/` y `public/`: estilos globales y assets (logos/iconografia retro 🌹).
- `convex/_generated/`: tipos/cliente generados desde el backend Convex.
- `convex/` (en la raiz del repo): acciones, mutaciones, queries y crons usadas por la web y mobile.
- `scripts/`: tareas de mantenimiento (ej. clonar datos Convex dev→prod).

## 🔌 Detalles tecnicos y APIs
- Auth: NextAuth con Google, Microsoft y credentials. La ruta `/api/auth/[...nextauth]` delega login a Convex para el caso de credenciales (`auth:authLogin`) y upsert OAuth (`auth:oauthUpsert`).
- Datos: el cliente Convex usa `NEXT_PUBLIC_CONVEX_URL`. Puedes apuntar a cloud o a un `convex dev` local.
- Protecciones: middleware de NextAuth protege rutas segun cookie de sesion y callback `jwt/session` refuerza rol/estado desde Convex.
- Juegos embebidos: URLs configurables via `NEXT_PUBLIC_TETRIS_URL`, `NEXT_PUBLIC_ARENA_URL`; `GameModeManager` ajusta layout/scroll en modo juego.
- Notificaciones/bandejas: dropdowns consumen queries/mutaciones de Convex (ver `convex/notifications.ts`, `convex/pushTokens.ts` para backends de notificaciones push usadas por mobile).
- Preferencias y favoritos: Zustand + Convex (`favoritesStore`, `getFavoritesByUser`, `toggleFavorite`).
- Checkout y premium: validaciones en `lib/validation.ts` y mutaciones en `convex/transactions.ts` / `convex/mutations/upgradePlan.ts`.
- Estado esperado al levantar local: la home carga catalogo desde Convex remoto; login OAuth funciona si `NEXTAUTH_SECRET` y las credenciales de Google/Microsoft estan definidas. Sin OAuth, las rutas protegidas devolverán error de autenticacion.

## 🌟 Dependencias principales
- Next.js 14 (App Router) + React 18.
- NextAuth/Auth.js para OAuth/credentials y middleware de sesion.
- Convex client para datos en tiempo real y mutaciones.
- Tailwind CSS 4 + shadcn/ui + Radix UI; utilidades `clsx`, `class-variance-authority`, `tailwind-merge`.
- Zustand para estado de carrito/favoritos; `react-hook-form` + `zod` para formularios.
- UI/extras: `framer-motion`, `embla-carousel-react`, `lucide-react`, `recharts`, `sonner`, `date-fns`.
