"use client";

import { useEffect, useState } from "react";
import { Progress } from "./control-center";
import Avatar from "@/components/avatar";
import { PERSONAS, ROLE_LABELS, type Persona, type PersonaRole } from "@/lib/personas";
import { identityFromPersona, saveIdentity, type Identity } from "@/lib/identity";
import { LANGS, type Lang, type T } from "@/lib/i18n";

const GROUPS: { role: PersonaRole; blurb: string }[] = [
  { role: "customer", blurb: "Cardholders querying their own payments" },
  { role: "analyst", blurb: "Review the queue and drive decisions" },
  { role: "admin", blurb: "Full oversight of cases, audit and config" },
];

export default function Login({
  onSignedIn,
  t,
  lang,
  onLang,
}: {
  onSignedIn: (id: Identity) => void;
  t: T;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [setup, setSetup] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite) { setToken(invite); setMode("accept"); }
    fetch("/api/auth").then(r => r.json()).then(d => { setDemo(d.demoEnabled); setSetup(d.setupAvailable); }).catch(() => setError("Sign-in is unavailable. Please refresh to retry."));
  }, []);
  async function signIn(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      saveIdentity(data.identity);
      window.history.replaceState(null, "", "/console#dashboard");
      onSignedIn(data.identity);
    } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  function pick(p: Persona) { void signIn({ action: "demo", userId: p.userId }); }

  return (
    <main className="login">
      <div className="login__inner">
        <header className="login__head">
          <div className="login__brandrow">
            <div className="login__brand">
              <img src="/brand/disputeguard-logo.svg" alt="" className="login__logo" />
              <span>DisputeGuard</span>
            </div>
            <select className="langselect" aria-label="Language" value={lang} onChange={(e) => onLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <h1 className="login__title">Welcome to the Showcase</h1>
          <p className="login__sub">Explore dispute workflows or sign in to your registered account. Sample payments do not move real money.</p>
        </header>

        {busy && <Progress label="Verifying your account and opening the workspace…" />}
        {error && <p className="control-error" role="alert">{error}</p>}
        <section className="account-login">
          <h2>{mode === "accept" ? "Accept your invitation" : mode === "setup" ? "Set up the first administrator" : "Registered account sign-in"}</h2>
          <form onSubmit={e => { e.preventDefault(); void signIn({ action: mode, email, password, token, name }); }}>
            {mode === "setup" && <><label>Full name<input value={name} onChange={e => setName(e.target.value)} required maxLength={80} /></label><label>Setup code<input type="password" value={token} onChange={e => setToken(e.target.value)} required /></label></>}
            {mode !== "accept" && <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label>}
            <label>{mode === "login" ? "Password" : "Choose a password (12–128 characters)"}<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 12} maxLength={128} required /></label>
            <button className="btn btn--primary" disabled={busy}>{mode === "accept" ? "Create account & continue" : mode === "setup" ? "Create administrator" : "Sign in"}</button>
          </form>
          {setup && mode === "login" && <button className="btn" onClick={() => setMode("setup")}>First administrator setup</button>}
          {mode !== "login" && <button className="btn" onClick={() => setMode("login")}>Back to sign-in</button>}
        </section>
        {demo && <p className="control-muted">Or explore with a showcase persona. Open persona access is enabled for this demonstration.</p>}
        {demo && GROUPS.map((g) => {
          const people = PERSONAS.filter((p) => p.role === g.role);
          return (
            <section className="login__group" key={g.role}>
              <div className="login__grouphead">
                <span className={`rolepill rolepill--${g.role}`}>{ROLE_LABELS[g.role]}</span>
                <span className="login__groupblurb">{g.blurb}</span>
              </div>
              <div className="login__grid">
                {people.map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    className="personacard"
                    aria-label={`Sign in as ${p.name}`}
                    disabled={busy}
                    onClick={() => pick(p)}
                  >
                    <Avatar seed={p.name} initials={p.initials} size={52} />
                    <div className="personacard__body">
                      <div className="personacard__name">{p.name}</div>
                      <div className="personacard__meta">
                        {p.title} · {p.city}
                      </div>
                      <div className="personacard__blurb">{p.blurb}</div>
                    </div>
                    <span className="personacard__go" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <p className="login__foot">
          Showcase personas use demonstration data. Registered accounts use password sign-in and server-verified roles.
          Back to the <a href="/">landing page</a>.
        </p>
      </div>
    </main>
  );
}
