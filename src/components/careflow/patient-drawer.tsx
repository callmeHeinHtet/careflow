"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, HeartPulse, Stethoscope, X } from "lucide-react";
import type { Patient, Role } from "../../lib/types";
import { stageLabel } from "./constants";
import { PatientJourney, PriorityBadge } from "./ui";

export function PatientDrawer({ patient, onClose, onTriage, onConsult, onView, can }: { patient: Patient; onClose: () => void; onTriage: () => void; onConsult: () => void; onView: (view: "pharmacy" | "billing") => void; can: (roles: Role[]) => boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    closeRef.current?.focus();
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); previous?.focus(); };
  }, [onClose]);

  return <div className="overlay"><section className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="patient-drawer-title"><div className="drawer-head"><div><span className="record-kicker">Patient record · {patient.queueNumber}</span><h2 id="patient-drawer-title">{patient.name}</h2><p className="muted">{patient.age} years · {patient.sex} · {patient.phone}</p></div><button ref={closeRef} className="icon-button" aria-label="Close patient details" onClick={onClose}><X size={19} /></button></div><PatientJourney patient={patient} />{patient.allergies.length > 0 && <div className="allergy-banner"><AlertTriangle size={18} /><div><strong>Allergy alert</strong><span>{patient.allergies.join(", ")}</span></div></div>}<div className="detail-section"><span className="detail-label">Demographics</span><div className="detail-grid"><span><small>Address</small>{patient.address}</span><span><small>Department</small>{patient.department}</span><span><small>Arrival</small><b className="mono">{patient.arrival}</b></span><span><small>Allergies</small>{patient.allergies.length ? <strong className="danger-text">{patient.allergies.join(", ")}</strong> : "None recorded"}</span></div></div><div className="detail-section"><span className="detail-label">Current visit</span><div className="visit-summary"><div><PriorityBadge priority={patient.priority} /><strong>{stageLabel[patient.stage]}</strong></div><p>{patient.symptoms}</p>{patient.vitals && <div className="vitals">{[["Temp", `${patient.vitals.temperature}°C`], ["BP", patient.vitals.bloodPressure], ["HR", `${patient.vitals.heartRate} bpm`], ["SpO2", `${patient.vitals.spo2}%`]].map(([label, value]) => <span key={label}><small>{label}</small>{value}</span>)}</div>}</div></div><div className="detail-section"><span className="detail-label">Visit history</span><div className="history-row"><span className="history-dot" /><div><strong>Today · {stageLabel[patient.stage]}</strong><p>{patient.diagnosis ?? "Visit in progress"}</p></div></div><div className="history-row"><span className="history-dot muted-dot" /><div><strong>18 Jun 2026 · Discharged</strong><p>Routine follow-up · fictional record</p></div></div></div><div className="drawer-actions">{["waiting", "triage"].includes(patient.stage) && <button className="primary-button" disabled={!can(["Nurse", "Reception"])} title={!can(["Nurse", "Reception"]) ? "Only reception or nursing can open triage." : undefined} onClick={onTriage}><HeartPulse size={16} />Open triage</button>}{patient.stage === "consultation" && <button className="primary-button" disabled={!can(["Doctor"])} onClick={onConsult}><Stethoscope size={16} />Start consultation</button>}{patient.stage === "pharmacy" && <button className="secondary-button" onClick={() => { onClose(); onView("pharmacy"); }}>View pharmacy</button>}{patient.stage === "billing" && <button className="secondary-button" onClick={() => { onClose(); onView("billing"); }}>View billing</button>}</div></section></div>;
}
