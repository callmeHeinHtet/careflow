import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AuthFrame } from "../../components/auth/auth-frame";
import { MfaForm } from "./mfa-form";

export default async function VerifyMfaPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.mfaEnrolled) redirect("/enroll-mfa");
  if (session.user.mfaVerified) redirect("/");

  return (
    <AuthFrame eyebrow="Second verification" title="Confirm it’s you" detail="This extra step protects patient operations if an email link is intercepted.">
      <MfaForm />
    </AuthFrame>
  );
}
