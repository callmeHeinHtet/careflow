"use client";

import { Bell, CalendarDays, Clock3, Menu, RotateCcw, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Patient, Role } from "../../lib/types";
import { navItems, roles, type ViewId } from "./constants";

type Props = { view: ViewId; setView: (view: ViewId) => void; role: Role; setRole: Dispatch<SetStateAction<Role>>; query: string; setQuery: (value: string) => void; mobileNav: boolean; setMobileNav: (open: boolean) => void; reset: () => void; queueCount: number; patients: Patient[]; notice: string; children: React.ReactNode };

export function AppShell({ view, setView, role, setRole, mobileNav, setMobileNav, reset, queueCount, notice, children }: Props) {
  const navGroups = [
    { label: "Main menu", ids: ["overview", "appointments", "queue", "patients", "billing", "pharmacy"] },
    { label: "Operations", ids: ["triage", "consultation", "services"] },
    { label: "Reports", ids: ["audit", "analytics"] },
    { label: "Settings", ids: ["users", "departments", "settings"] },
  ] as const;

  return <div className="app-shell simple-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <div className="sidebar-head">
        <div className="brand"><span className="brand-mark">✣</span><span className="brand-copy"><strong>CareFlow</strong></span></div>
        <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18} /></button>
      </div>
      <nav aria-label="Workspaces">
        {navGroups.map((group) => <div className="nav-group" key={group.label}>
          <span className="nav-group-label">{group.label}</span>
          {group.ids.map((id) => {
            const item = navItems.find((candidate) => candidate.id === id);
            if (!item) return null;
            const Icon = item.icon;
            return <button key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => { setView(id); setMobileNav(false); }}><Icon size={16} /><span>{item.label}</span>{id === "queue" && <span className="nav-count">{queueCount}</span>}</button>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-foot"><span><span className="status-dot" />Systems local</span><button className="reset-button" onClick={reset}><RotateCcw size={14} />Reset data</button></div>
    </aside>
    {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

    <div className="shell-body">
      <header className="topbar">
        <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
        <div className="topbar-spacer" />
        <div className="top-actions"><span className="topbar-meta"><CalendarDays size={15} />30 Aug 2026, Sun</span><span className="topbar-meta"><Clock3 size={15} />Morning Shift</span><button className="icon-button notification-button" aria-label="Notifications"><Bell size={16} /><span /></button><div className="avatar" aria-hidden="true">M</div><label className="role-select staff-select"><span className="staff-name">Dr. May Thandar</span><select aria-label="Switch role" value={role} onChange={(event) => setRole(event.target.value as Role)}>{roles.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      </header>
      <main className="main"><div className="content">{notice && <div className="live-notice" role="status" aria-live="polite">{notice}</div>}{children}</div></main>
    </div>
  </div>;
}
