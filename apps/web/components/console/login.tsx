"use client";

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
  function pick(p: Persona) {
    const id = identityFromPersona(p);
    saveIdentity(id);
    onSignedIn(id);
  }

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
          <h1 className="login__title">{t("login.title")}</h1>
          <p className="login__sub">{t("login.sub")} No real people or real money.</p>
        </header>

        {GROUPS.map((g) => {
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
          Demonstration data and flows — this does not authenticate real users or move money.
          Back to the <a href="/">landing page</a>.
        </p>
      </div>
    </main>
  );
}
