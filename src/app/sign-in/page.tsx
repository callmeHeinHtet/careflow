import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AuthFrame } from "../../components/auth/auth-frame";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user.mfaEnrolled && session.user.mfaVerified) redirect("/");
  if (session?.user.mfaEnrolled) redirect("/verify-mfa");
  if (session?.user) redirect("/enroll-mfa");

  return (
    <AuthFrame eyebrow="Staff access" title="Sign in to your shift" detail="Use the email address assigned to your CareFlow staff profile.">
      <SignInForm showLocalInbox={process.env.NODE_ENV !== "production"} />
    </AuthFrame>
  );
}
