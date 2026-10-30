export type DemoTransaction = {
  id: string;
  merchant: string;
  category: string;
  date: string;
  amountMinor: number;
  status: "Completed" | "Pending";
  reason: string;
};

export const demoCards = [
  {
    name: "Everyday",
    kind: "Debit",
    ending: "4821",
    tone: "cobalt",
    transactions: [
      {
        id: "TX-0042",
        merchant: "Atlas Online",
        category: "Shopping",
        date: "28 Oct · 14:32",
        amountMinor: 124900,
        status: "Completed",
        reason: "I don’t recognise this payment.",
      },
      {
        id: "TX-0043",
        merchant: "Corner Coffee",
        category: "Food & drink",
        date: "28 Oct · 09:15",
        amountMinor: 6800,
        status: "Completed",
        reason: "I was charged more than expected.",
      },
      {
        id: "TX-0044",
        merchant: "Fresh Market",
        category: "Groceries",
        date: "27 Oct · 17:46",
        amountMinor: 43250,
        status: "Pending",
        reason: "This sample payment is still processing.",
      },
    ],
  },
  {
    name: "Online",
    kind: "Virtual",
    ending: "9016",
    tone: "midnight",
    transactions: [
      {
        id: "TX-0051",
        merchant: "Studio Supply",
        category: "Shopping",
        date: "28 Oct · 11:08",
        amountMinor: 89900,
        status: "Completed",
        reason: "The order hasn’t arrived.",
      },
      {
        id: "TX-0052",
        merchant: "Stream House",
        category: "Subscription",
        date: "27 Oct · 08:00",
        amountMinor: 14900,
        status: "Completed",
        reason: "I cancelled this subscription.",
      },
      {
        id: "TX-0053",
        merchant: "Cloud Desk",
        category: "Software",
        date: "26 Oct · 16:24",
        amountMinor: 22900,
        status: "Completed",
        reason: "I was charged twice.",
      },
    ],
  },
  {
    name: "Travel",
    kind: "Debit",
    ending: "7630",
    tone: "ice",
    transactions: [
      {
        id: "TX-0061",
        merchant: "Coastline Stay",
        category: "Accommodation",
        date: "26 Oct · 12:10",
        amountMinor: 245000,
        status: "Completed",
        reason: "The cancelled booking was not refunded.",
      },
      {
        id: "TX-0062",
        merchant: "City Shuttle",
        category: "Transport",
        date: "26 Oct · 10:45",
        amountMinor: 18500,
        status: "Completed",
        reason: "I was charged twice.",
      },
      {
        id: "TX-0063",
        merchant: "Platform Café",
        category: "Food & drink",
        date: "25 Oct · 07:30",
        amountMinor: 9600,
        status: "Pending",
        reason: "This sample payment is still processing.",
      },
    ],
  },
] satisfies {
  name: string;
  kind: string;
  ending: string;
  tone: string;
  transactions: DemoTransaction[];
}[];

export function formatRand(amountMinor: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amountMinor / 100);
}
