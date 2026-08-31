import { redirect } from "next/navigation";
import { auth } from "../auth";
import { CareFlowApp } from "../components/careflow/careflow-app";
import type { Role } from "../lib/types";
import { StaffRole } from "../generated/prisma/client";
import { getDb } from "../server/db/client";
import { getWorkspaceSnapshot } from "../server/repositories/workspace-repository";

const roleLabels = {
  RECEPTION: "Reception",
  NURSE: "Nurse",
  DOCTOR: "Doctor",
  PHARMACY: "Pharmacy",
  CASHIER: "Cashier",
  ADMIN: "Admin",
} satisfies Record<string, Role>;

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.mfaEnrolled) redirect("/enroll-mfa");
  if (!session.user.mfaVerified) redirect("/verify-mfa");

  const role = session.user.role ? roleLabels[session.user.role] : null;
  if (!role) redirect("/sign-in");
  const initialData = await getWorkspaceSnapshot(getDb(), {
    actorUserId: session.user.id,
    role: session.user.role as StaffRole,
  });

  return (
    <CareFlowApp
      role={role}
      displayName={session.user.displayName ?? session.user.name ?? "CareFlow staff"}
      initialData={initialData}
    />
  );
}
