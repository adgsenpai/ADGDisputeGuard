"use client";

import { NotificationBell } from "./control-center";
import { useState } from "react";
import Avatar from "@/components/avatar";
import Icon, { type IconName } from "@/components/console/icons";
import { ROLE_LABELS } from "@/lib/personas";
import type { Identity } from "@/lib/identity";
import { LANGS, type Lang, type T } from "@/lib/i18n";

export type ViewKey =
  | "dashboard"
  | "transactions"
  | "disputes"
  | "investigations"
  | "evidence"
  | "audit"
  | "settings"
  | "statement"
  | "notifications"
  | "monitoring"
  | "assistant"
  | "users";

export const NAV: { key: ViewKey; label: string; icon: IconName; roles?: Identity["role"][] }[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "transactions", label: "Transactions", icon: "transactions" },
  { key: "disputes", label: "Disputes", icon: "disputes" },
  { key: "investigations", label: "Investigations", icon: "investigations" },
  { key: "evidence", label: "Evidence", icon: "evidence" },
  { key: "audit", label: "Audit log", icon: "audit" },
  { key: "statement", label: "Bank statement", icon: "transactions" },
  { key: "assistant", label: "Ask assistant", icon: "investigations" },
  { key: "notifications", label: "Notifications", icon: "evidence" },
  { key: "monitoring", label: "Monitoring", icon: "dashboard", roles: ["admin"] },
  { key: "users", label: "People & access", icon: "settings", roles: ["admin"] },
  { key: "settings", label: "Settings", icon: "settings" },
];

export const VIEW_META: Record<ViewKey, { title: string; subtitle: string }> = {
  statement: { title: "Bank statement", subtitle: "Review payments and check for possible disputes" },
  assistant: { title: "Investigation assistant", subtitle: "Guided support for customers and analysts" },
  notifications: { title: "Notifications", subtitle: "Case activity and email updates" },
  monitoring: { title: "Monitoring", subtitle: "Continuous portfolio checks and review flags" },
  users: { title: "People & access", subtitle: "Customer onboarding, invitations and permissions" },
  dashboard: { title: "Dashboard", subtitle: "Portfolio overview and recent activity" },
  transactions: { title: "Transactions", subtitle: "Card payments visible to you" },
  disputes: { title: "Disputes", subtitle: "Queue and case workspace" },
  investigations: { title: "Investigations", subtitle: "Bounded, AI-assisted case investigations" },
  evidence: { title: "Evidence", subtitle: "Uploaded supporting documents" },
  audit: { title: "Audit log", subtitle: "Every state change, in order" },
  settings: { title: "Settings", subtitle: "Your profile and session" },
};

export default function Shell({
  identity,
  view,
  onNavigate,
  onSignOut,
  badges,
  t,
  lang,
  onLang,
  children,
}: {
  identity: Identity;
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  onSignOut: () => void;
  badges?: Partial<Record<ViewKey, number>>;
  t: T;
  lang: Lang;
  onLang: (l: Lang) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  function go(v: ViewKey) {
    onNavigate(v);
    setOpen(false);
  }

  return (
    <div className="shell" data-testid="console-shell">
      {open && <div className="shell__scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <img src="/brand/disputeguard-logo.svg" alt="" className="sidebar__logo" />
          <div>
            <div className="sidebar__brandname">DisputeGuard</div>
            <div className="sidebar__brandsub">SHOWCASE</div>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {NAV.filter(item => !item.roles || item.roles.includes(identity.role)).map((item) => (
            <button
              key={item.key}
              type="button"
              data-nav={item.key}
              className={`nav__item ${view === item.key ? "nav__item--active" : ""}`}
              aria-current={view === item.key ? "page" : undefined}
              onClick={() => go(item.key)}
            >
              <Icon name={item.icon} />
              <span>{t(`nav.${item.key}`, item.label)}</span>
              {badges?.[item.key] ? <span className="nav__badge">{badges[item.key]}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar__foot">
          <Avatar seed={identity.name} initials={identity.initials} size={38} />
          <div className="sidebar__who">
            <div className="sidebar__name">{identity.name}</div>
            <div className="sidebar__role">
              <span className={`rolepill rolepill--${identity.role}`}>{ROLE_LABELS[identity.role]}</span>
            </div>
          </div>
          <button className="iconbtn" onClick={onSignOut} aria-label={t("action.signout")} title={t("action.signout")}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <button className="iconbtn topbar__menu" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="topbar__titles">
            <h1 className="topbar__title">{t(`view.${view}.title`, VIEW_META[view].title)}</h1>
            <p className="topbar__sub">{t(`view.${view}.sub`, VIEW_META[view].subtitle)}</p>
          </div>
          <div className="topbar__spacer" />
          <NotificationBell count={badges?.notifications || 0} onClick={() => go("notifications")} />
          <select
            className="langselect"
            aria-label="Language"
            value={lang}
            onChange={(e) => onLang(e.target.value as Lang)}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <div className="topbar__who">
            <Avatar seed={identity.name} initials={identity.initials} size={34} />
            <div className="topbar__whotext">
              <span className="topbar__whoname">{identity.name}</span>
              <span className={`rolepill rolepill--${identity.role}`}>{ROLE_LABELS[identity.role]}</span>
            </div>
          </div>
        </header>

        {/* Keeps the sign-in helper's stable anchor text. */}
        <span className="visually-hidden">DisputeGuard Console</span>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
