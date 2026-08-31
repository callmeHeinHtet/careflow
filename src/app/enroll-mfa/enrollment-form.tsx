"use client";

import { ArrowRight, Check, Copy, KeyRound, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Enrollment = { secret: string; uri: string };

export function EnrollmentForm() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [token, setToken] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    setPending(true); setError("");
    const response = await fetch("/api/auth/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" } });
    const body = await response.json();
    if (response.ok) setEnrollment(body.data);
    else setError(body.error?.message ?? "MFA setup could not be started");
    setPending(false);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const response = await fetch("/api/auth/mfa/setup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const body = await response.json();
    if (response.ok) setRecoveryCodes(body.data.recoveryCodes);
    else setError(body.error?.message ?? "The code could not be verified");
    setPending(false);
  }

  if (recoveryCodes) {
    return (
      <div className="auth-form">
        <div className="auth-callout success"><Check size={17} /><div><strong>Authenticator connected</strong><p>Save these recovery codes now. Each code works once and cannot be shown again.</p></div></div>
        <div className="recovery-grid mono" aria-label="Recovery codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div>
        <button className="auth-secondary" type="button" onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))}><Copy size={16} />Copy all codes</button>
        <button className="auth-primary" type="button" onClick={() => { router.replace("/"); router.refresh(); }}>Enter CareFlow<ArrowRight size={17} /></button>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="auth-form">
        <div className="auth-callout"><KeyRound size={17} /><div><strong>Authenticator app required</strong><p>Use 1Password, Google Authenticator, Microsoft Authenticator, or another TOTP app.</p></div></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-primary" type="button" onClick={() => void begin()} disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}Start secure setup</button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={confirm}>
      <div className="setup-step"><span>1</span><div><strong>Add the account</strong><p>In your authenticator app, choose manual entry and use this key.</p></div></div>
      <div className="secret-key mono"><code>{enrollment.secret}</code><button type="button" aria-label="Copy setup key" onClick={() => void navigator.clipboard.writeText(enrollment.secret)}><Copy size={16} /></button></div>
      <details className="auth-uri"><summary>Need the full setup URI?</summary><code className="mono">{enrollment.uri}</code></details>
      <div className="setup-step"><span>2</span><div><strong>Confirm the connection</strong><p>Enter the current six-digit code from the app.</p></div></div>
      <label htmlFor="enrollment-token">Verification code</label>
      <input className="auth-code-input mono" id="enrollment-token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ""))} required autoFocus />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-primary" type="submit" disabled={pending || token.length !== 6}>{pending ? "Verifying…" : "Verify and finish"}<ArrowRight size={17} /></button>
    </form>
  );
}
