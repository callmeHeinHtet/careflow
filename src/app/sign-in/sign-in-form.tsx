"use client";

import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export function SignInForm({ showLocalInbox }: { showLocalInbox: boolean }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await signIn("nodemailer", { email, redirect: false, callbackUrl: "/" });
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-success" role="status">
        <CheckCircle2 size={21} />
        <div><strong>Check your inbox</strong><p>If this address has an active CareFlow invitation, a 15-minute sign-in link is on its way.</p></div>
        <button type="button" className="auth-text-button" onClick={() => setSent(false)}>Use another address</button>
        {showLocalInbox && <a className="auth-local-link" href="http://localhost:8025" target="_blank" rel="noreferrer">Open the local Mailpit inbox</a>}
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="staff-email">Work email</label>
      <div className="auth-input"><Mail size={17} /><input id="staff-email" name="email" type="email" autoComplete="email" placeholder="you@careflow.test" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></div>
      <p className="auth-help">Access is invitation-only. There is no public account registration.</p>
      <button className="auth-primary" type="submit" disabled={pending}>{pending ? "Sending secure link…" : "Email me a sign-in link"}<ArrowRight size={17} /></button>
    </form>
  );
}
