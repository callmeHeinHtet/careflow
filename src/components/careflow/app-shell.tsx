"use client";

import { Bell, CalendarDays, Clock3, LogOut, Menu, Search, X } from "lucide-react";
import { signOut } from "next-auth/react";
import type { Patient, Role } from "../../lib/types";
import { navItems, type ViewId } from "./constants";

type Props = { view: ViewId; setView: (view: ViewId) => void; role: Role; displayName: string; dateLabel: string; query: string; setQuery: (value: string) => void; mobileNav: boolean; setMobileNav: (open: boolean) => void; queueCount: number; patients: Patient[]; notice: string; children: React.ReactNode };

export function AppShell({ view, setView, role, displayName, dateLabel, query, setQuery, mobileNav, setMobileNav, queueCount, notice, children }: Props) {
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
      <div className="sidebar-foot"><span><span className="status-dot" />PostgreSQL synced</span></div>
    </aside>
    {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

    <div className="shell-body">
      <header className="topbar">
        <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
        <label className="search"><Search size={16} /><span className="sr-only">Search patients</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patients, queue or department" /></label>
        <div className="top-actions"><span className="topbar-meta"><CalendarDays size={15} />{dateLabel}</span><span className="topbar-meta"><Clock3 size={15} />Morning Shift</span><button className="icon-button notification-button" aria-label="Notifications"><Bell size={16} /><span /></button><div className="avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</div><div className="staff-identity"><span className="staff-name">{displayName}</span><small>{role}</small></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => void signOut({ callbackUrl: "/sign-in" })}><LogOut size={16} /></button></div>
      </header>
      <main className="main"><div className="content">{notice && <div className="live-notice" role="status" aria-live="polite">{notice}</div>}{children}</div></main>
    </div>
  </div>;
}
