// playverse-web/types/next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role?: "free" | "premium" | "admin";
      status?: "Activo" | "Baneado";
    };
  }
  interface User extends DefaultUser {
    role?: "free" | "premium" | "admin";
    status?: "Activo" | "Baneado";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "free" | "premium" | "admin";
    status?: "Activo" | "Baneado";
  }
}
