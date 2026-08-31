import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AuthFrame } from "../../components/auth/auth-frame";
import { EnrollmentForm } from "./enrollment-form";

export default async function EnrollMfaPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.mfaEnrolled && session.user.mfaVerified) redirect("/");
  if (session.user.mfaEnrolled) redirect("/verify-mfa");

  return (
    <AuthFrame eyebrow="Security setup" title="Protect your staff account" detail="CareFlow requires a time-based verification code after every email sign-in.">
      <EnrollmentForm />
    </AuthFrame>
  );
}
