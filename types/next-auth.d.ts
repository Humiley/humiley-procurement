import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    roles?: Role[];
    departmentId?: string | null;
    isChief?: boolean;
    locale?: string;
    mustChangePw?: boolean;
  }

  interface Session {
    user: {
      id: string;
      roles: Role[];
      departmentId: string | null;
      isChief: boolean;
      locale: string;
      mustChangePw: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: Role[];
    departmentId?: string | null;
    isChief?: boolean;
    locale?: string;
    mustChangePw?: boolean;
  }
}
