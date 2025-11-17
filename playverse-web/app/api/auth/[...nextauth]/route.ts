// playverse-web/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type AuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import AzureAd from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials";
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexHttpClient(convexUrl);

const api = {
  queries: {
    getUserByEmail: {
      getUserByEmail: "queries/getUserByEmail:getUserByEmail",
    },
  },
  auth: {
    authLogin: "auth:authLogin",
    oauthUpsert: "auth:oauthUpsert",
  },
} as const;

const microsoftClientId =
  process.env.MICROSOFT_CLIENT_ID ?? process.env.AZURE_AD_CLIENT_ID;
const microsoftClientSecret =
  process.env.MICROSOFT_CLIENT_SECRET ?? process.env.AZURE_AD_CLIENT_SECRET;
const microsoftTenantId =
  process.env.MICROSOFT_TENANT_ID ?? process.env.AZURE_AD_TENANT_ID ?? "common";

if (!microsoftClientId || !microsoftClientSecret) {
  throw new Error(
    "Missing Microsoft/Azure AD OAuth credentials. Set MICROSOFT_* or AZURE_AD_* env vars."
  );
}

async function getProfileByEmail(email?: string | null) {
  if (!email) return { role: "free", status: "Activo" as const };
  try {
    const profile = await convex.query(
      api.queries.getUserByEmail.getUserByEmail as any,
      { email }
    );
    return {
      role: (profile as any)?.role ?? "free",
      status: (profile as any)?.status ?? "Activo",
    };
  } catch {
    return { role: "free", status: "Activo" as const };
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
      clientId: microsoftClientId,
      clientSecret: microsoftClientSecret,
      tenantId: microsoftTenantId,
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
        if (!res?.ok) {
          throw new Error(res?.error ?? "Credenciales invalidas");
        }
        const p = res.profile as any;
        if (p?.status === "Baneado") {
          throw new Error("ACCOUNT_BANNED");
        }
        return {
          id: String(p._id),
          name: p.name ?? "",
          email: p.email,
          role: p.role ?? "free",
          status: p.status ?? "Activo",
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
          avatarUrl: undefined,
          provider: account?.provider ?? "unknown",
          providerId: account?.providerAccountId ?? undefined,
        });
        const profile = await getProfileByEmail(user.email);
        if (profile.status === "Baneado") {
          return "/auth/login?error=ACCOUNT_BANNED";
        }
        return true;
      } catch (err) {
        console.error("oauthUpsert failed:", err);
        return "/auth/login?error=AUTH_ERROR";
      }
    },

    async jwt({ token, user }) {
      if (user) {
        (token as any).role = (user as any).role ?? (token as any).role ?? "free";
        (token as any).status = (user as any).status ?? (token as any).status ?? "Activo";
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.sub = (user as any).id ?? token.sub;
      }

      const profile = await getProfileByEmail(token.email as string | undefined);
      (token as any).role = profile.role ?? (token as any).role ?? "free";
      (token as any).status = profile.status ?? (token as any).status ?? "Activo";

      if ("picture" in (token as any)) delete (token as any).picture;
      if ("image" in (token as any)) delete (token as any).image;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        (session.user as any).role = (token as any).role ?? "free";
        (session.user as any).status = (token as any).status ?? "Activo";
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
