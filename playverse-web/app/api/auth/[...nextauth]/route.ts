// playverse-web/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type AuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import AzureAd from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexHttpClient(convexUrl);

async function getRoleByEmail(email?: string | null) {
  if (!email) return "free";
  try {
    const profile = await convex.query(
      api.queries.getUserByEmail.getUserByEmail as any,
      { email }
    );
    return (profile as any)?.role ?? "free";
  } catch {
    return "free";
  }
}

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    AzureAd({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
      authorization: { params: { scope: "openid profile email offline_access" } },
      checks: ["pkce", "state"],
      allowDangerousEmailAccountLinking: true,
    }),

    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const res = await convex.mutation(api.auth.authLogin as any, {
          email: String(creds.email).toLowerCase().trim(),
          password: String(creds.password),
        });
        if (!res?.ok) return null;
        const p = res.profile;
        // IMPORTANTE: no incluir picture/image para no inflar el JWT
        return {
          id: String(p._id),
          name: p.name ?? "",
          email: p.email,
          role: p.role ?? "free",
        } as any;
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      try {
        if (!user?.email) return false;
        await convex.mutation(api.auth.oauthUpsert as any, {
          email: user.email,
          name: user.name ?? "",
          // OJO: no dependemos del avatar acá; se maneja desde tu perfil.
          avatarUrl: undefined,
          provider: account?.provider ?? "unknown",
          providerId: account?.providerAccountId ?? undefined,
        });
        return true;
      } catch (err) {
        console.error("oauthUpsert failed:", err);
        return true;
      }
    },

    // JWT minimalista: solo id/email/name/role. Nada de imágenes ni objetos grandes.
    async jwt({ token, user }) {
      if (user) {
        (token as any).role = (user as any).role ?? (token as any).role ?? "free";
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.sub = (user as any).id ?? token.sub;
      }

      // Refrescar role desde Convex por si cambió
      const role = await getRoleByEmail(token.email as string | undefined);
      (token as any).role = role ?? (token as any).role ?? "free";

      // Sanear posibles arrastres de sesiones viejas
      if ("picture" in (token as any)) delete (token as any).picture;
      if ("image" in (token as any)) delete (token as any).image;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as any).role = (token as any).role ?? "free";
        // No seteamos image desde token para no depender del JWT
        // El front puede leer avatar desde Convex (getUserByEmail) cuando lo necesite.
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
