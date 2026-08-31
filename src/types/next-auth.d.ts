import type { DefaultSession } from "next-auth";
import type { StaffRole } from "../generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: StaffRole;
      employeeNumber?: string;
      displayName?: string | null;
      mfaEnrolled: boolean;
      mfaVerified: boolean;
    };
  }

  interface User {
    status?: string;
    mfaEnrolledAt?: Date | null;
  }
}

export {};
