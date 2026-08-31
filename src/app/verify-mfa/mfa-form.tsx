"use client";

import { ArrowRight, KeyRound, LifeBuoy } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const endpoint = mode === "totp" ? "/api/auth/mfa/verify" : "/api/auth/mfa/recovery";
    const payload = mode === "totp" ? { token: value } : { code: value };
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (response.ok) { router.replace("/"); router.refresh(); return; }
    setError(body.error?.message ?? "Verification failed"); setPending(false);
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-mode" role="tablist" aria-label="Verification method">
        <button type="button" role="tab" aria-selected={mode === "totp"} className={mode === "totp" ? "active" : ""} onClick={() => { setMode("totp"); setValue(""); setError(""); }}><KeyRound size={15} />Authenticator</button>
        <button type="button" role="tab" aria-selected={mode === "recovery"} className={mode === "recovery" ? "active" : ""} onClick={() => { setMode("recovery"); setValue(""); setError(""); }}><LifeBuoy size={15} />Recovery code</button>
      </div>
      <label htmlFor="mfa-value">{mode === "totp" ? "Six-digit code" : "One-time recovery code"}</label>
      <input className="auth-code-input mono" id="mfa-value" inputMode={mode === "totp" ? "numeric" : "text"} autoComplete="one-time-code" maxLength={mode === "totp" ? 6 : 16} placeholder={mode === "totp" ? "000000" : "ABCDE-FGHIJ"} value={value} onChange={(event) => setValue(mode === "totp" ? event.target.value.replace(/\D/g, "") : event.target.value.toUpperCase())} required autoFocus />
      <p className="auth-help">{mode === "totp" ? "Enter the current code shown in your authenticator app." : "Using a recovery code permanently consumes it."}</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-primary" type="submit" disabled={pending || (mode === "totp" && value.length !== 6)}>{pending ? "Verifying…" : "Verify and continue"}<ArrowRight size={17} /></button>
    </form>
  );
}
