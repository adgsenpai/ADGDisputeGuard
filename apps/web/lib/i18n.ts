// Lightweight i18n for the console. Three South African languages: English,
// isiZulu and Afrikaans. Translations are illustrative (demonstration quality).
// Missing keys fall back to English, then to the key itself.

export type Lang = "en" | "zu" | "af";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zu", label: "isiZulu" },
  { code: "af", label: "Afrikaans" },
];

type Dict = Record<string, string>;

const en: Dict = {
  "brand.console": "Console",
  "nav.dashboard": "Dashboard",
  "nav.transactions": "Transactions",
  "nav.disputes": "Disputes",
  "nav.investigations": "Investigations",
  "nav.evidence": "Evidence",
  "nav.audit": "Audit log",
  "nav.settings": "Settings",
  "view.dashboard.title": "Dashboard",
  "view.dashboard.sub": "Portfolio overview and recent activity",
  "view.transactions.title": "Transactions",
  "view.transactions.sub": "Card payments visible to you",
  "view.disputes.title": "Disputes",
  "view.disputes.sub": "Queue and case workspace",
  "view.investigations.title": "Investigations",
  "view.investigations.sub": "Bounded, AI-assisted case investigations",
  "view.evidence.title": "Evidence",
  "view.evidence.sub": "Uploaded supporting documents",
  "view.audit.title": "Audit log",
  "view.audit.sub": "Every state change, in order",
  "view.settings.title": "Settings",
  "view.settings.sub": "Your profile and session",
  "action.signout": "Sign out",
  "action.search": "Search…",
  "action.open_dispute": "Open dispute",
  "kpi.transactions": "Transactions",
  "kpi.open": "Open disputes",
  "kpi.approved": "Approved",
  "kpi.rejected": "Rejected",
  "kpi.avgrisk": "Avg advisory risk",
  "kpi.disputed": "Disputed value",
  "login.title": "Choose who to sign in as",
  "login.sub": "Passwordless demo sign-in. Pick a persona — your role (RBAC) comes from who you choose.",
};

const zu: Dict = {
  "brand.console": "Ikhonsoli",
  "nav.dashboard": "Ideshibhodi",
  "nav.transactions": "Izintengiselwano",
  "nav.disputes": "Izikhalazo",
  "nav.investigations": "Uphenyo",
  "nav.evidence": "Ubufakazi",
  "nav.audit": "Irekhodi lokuhlola",
  "nav.settings": "Izilungiselelo",
  "view.dashboard.title": "Ideshibhodi",
  "view.dashboard.sub": "Ukubuka konke nemisebenzi yakamuva",
  "view.transactions.title": "Izintengiselwano",
  "view.transactions.sub": "Izinkokhelo zekhadi ozibonayo",
  "view.disputes.title": "Izikhalazo",
  "view.disputes.sub": "Ulayini nendawo yecala",
  "view.investigations.title": "Uphenyo",
  "view.investigations.sub": "Uphenyo lwamacala olusizwa yi-AI olunemikhawulo",
  "view.evidence.title": "Ubufakazi",
  "view.evidence.sub": "Amadokhumenti alayishiwe",
  "view.audit.title": "Irekhodi lokuhlola",
  "view.audit.sub": "Konke ukushintsha kwesimo, ngokulandelana",
  "view.settings.title": "Izilungiselelo",
  "view.settings.sub": "Iphrofayela yakho nesikhathi sokungena",
  "action.signout": "Phuma",
  "action.search": "Sesha…",
  "action.open_dispute": "Vula isikhalazo",
  "kpi.transactions": "Izintengiselwano",
  "kpi.open": "Izikhalazo ezivuliwe",
  "kpi.approved": "Kuvunyiwe",
  "kpi.rejected": "Kwenqatshiwe",
  "kpi.avgrisk": "Ubungozi obumaphakathi",
  "kpi.disputed": "Inani eliphikisanwayo",
  "login.title": "Khetha ozongena njengaye",
  "login.sub": "Ukungena ngaphandle kwephasiwedi. Khetha umuntu — indima yakho (RBAC) ivela kolukhethayo.",
};

const af: Dict = {
  "brand.console": "Konsole",
  "nav.dashboard": "Paneelbord",
  "nav.transactions": "Transaksies",
  "nav.disputes": "Geskille",
  "nav.investigations": "Ondersoeke",
  "nav.evidence": "Bewyse",
  "nav.audit": "Ouditlogboek",
  "nav.settings": "Instellings",
  "view.dashboard.title": "Paneelbord",
  "view.dashboard.sub": "Portefeulje-oorsig en onlangse aktiwiteit",
  "view.transactions.title": "Transaksies",
  "view.transactions.sub": "Kaartbetalings wat vir jou sigbaar is",
  "view.disputes.title": "Geskille",
  "view.disputes.sub": "Tou en saakwerkruimte",
  "view.investigations.title": "Ondersoeke",
  "view.investigations.sub": "Begrensde, KI-ondersteunde saakondersoeke",
  "view.evidence.title": "Bewyse",
  "view.evidence.sub": "Opgelaaide stawende dokumente",
  "view.audit.title": "Ouditlogboek",
  "view.audit.sub": "Elke toestandverandering, in volgorde",
  "view.settings.title": "Instellings",
  "view.settings.sub": "Jou profiel en sessie",
  "action.signout": "Meld af",
  "action.search": "Soek…",
  "action.open_dispute": "Open dispuut",
  "kpi.transactions": "Transaksies",
  "kpi.open": "Oop geskille",
  "kpi.approved": "Goedgekeur",
  "kpi.rejected": "Afgekeur",
  "kpi.avgrisk": "Gem. adviserende risiko",
  "kpi.disputed": "Betwiste waarde",
  "login.title": "Kies wie om as aan te meld",
  "login.sub": "Wagwoordlose demo-aanmelding. Kies 'n persona — jou rol (RBAC) kom van wie jy kies.",
};

export const DICTS: Record<Lang, Dict> = { en, zu, af };
export const I18N_KEYS = Object.keys(en);

const KEY = "dg.lang";

export function loadLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem(KEY) as Lang | null;
    if (v === "en" || v === "zu" || v === "af") return v;
  } catch {}
  return "en";
}
export function saveLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {}
}

export type T = (key: string, fallback?: string) => string;
export function makeT(lang: Lang): T {
  return (key, fallback) => DICTS[lang][key] ?? en[key] ?? fallback ?? key;
}
