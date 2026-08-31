import { Activity, Check, ShieldCheck } from "lucide-react";

export function AuthFrame({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-context" aria-label="CareFlow clinical operations">
        <div className="auth-brand"><span>✣</span><strong>CareFlow</strong></div>
        <div className="auth-context-copy">
          <p className="auth-overline">Clinical operations workspace</p>
          <h1>One secure handoff from arrival to discharge.</h1>
          <p>CareFlow keeps each team on the same operational record while access stays tied to the staff member responsible.</p>
        </div>
        <ol className="auth-path" aria-label="Patient flow">
          {["Register", "Triage", "Consult", "Pharmacy", "Billing", "Discharge"].map((step, index) => (
            <li key={step} className={index < 2 ? "complete" : index === 2 ? "current" : ""}>
              <span>{index < 2 ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span>
              <div><strong>{step}</strong><small>{index === 2 ? "Active workspace" : index < 2 ? "Recorded" : "Protected step"}</small></div>
            </li>
          ))}
        </ol>
        <div className="auth-system-note"><Activity size={14} /><span>Fictional demonstration data only</span></div>
      </section>

      <section className="auth-entry">
        <div className="auth-card">
          <span className="auth-shield"><ShieldCheck size={20} /></span>
          <p className="auth-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-detail">{detail}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
