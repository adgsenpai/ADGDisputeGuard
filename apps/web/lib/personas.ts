// Demo personas for the passwordless sign-in. Each persona maps to a backend
// user id (see lib/api/store.ts DEMO_USERS) and carries its RBAC role. Names
// are invented Mzansi-style personas for the demo — not real people.

export type PersonaRole = "customer" | "analyst" | "admin";

export type Persona = {
  userId: number;
  name: string;
  role: PersonaRole;
  title: string;
  city: string;
  initials: string;
  blurb: string;
};

export const PERSONAS: Persona[] = [
  {
    userId: 1,
    name: "Thabo Nkosi",
    role: "customer",
    title: "Cardholder",
    city: "Johannesburg",
    initials: "TN",
    blurb: "Everyday spender querying a few card payments.",
  },
  {
    userId: 2,
    name: "Lerato Mokoena",
    role: "customer",
    title: "Cardholder",
    city: "Pretoria",
    initials: "LM",
    blurb: "Online shopper with a duplicate subscription charge.",
  },
  {
    userId: 3,
    name: "Sipho Dlamini",
    role: "customer",
    title: "Cardholder",
    city: "Durban",
    initials: "SD",
    blurb: "Travels often; disputing a large online order.",
  },
  {
    userId: 4,
    name: "Naledi Khumalo",
    role: "customer",
    title: "Cardholder",
    city: "Cape Town",
    initials: "NK",
    blurb: "Careful budgeter checking unexpected fees.",
  },
  {
    userId: 5,
    name: "Ayanda Zulu",
    role: "customer",
    title: "Cardholder",
    city: "Soweto",
    initials: "AZ",
    blurb: "Prepaid airtime and groceries on the go.",
  },
  {
    userId: 9,
    name: "Nomsa Mahlangu",
    role: "analyst",
    title: "Dispute Analyst",
    city: "Johannesburg",
    initials: "NM",
    blurb: "Reviews the dispute queue and drives decisions.",
  },
  {
    userId: 10,
    name: "Kagiso Pilane",
    role: "analyst",
    title: "Senior Analyst",
    city: "Centurion",
    initials: "KP",
    blurb: "Handles escalations and complex investigations.",
  },
  {
    userId: 99,
    name: "Mandla Ndlovu",
    role: "admin",
    title: "Platform Admin",
    city: "Sandton",
    initials: "MN",
    blurb: "Full oversight of cases, audit and configuration.",
  },
];

export function personaByUserId(userId: number): Persona | undefined {
  return PERSONAS.find((p) => p.userId === userId);
}

export const ROLE_LABELS: Record<PersonaRole, string> = {
  customer: "Customer",
  analyst: "Analyst",
  admin: "Admin",
};
