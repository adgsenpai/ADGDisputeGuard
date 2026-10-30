import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DisputeGuard — Every dispute deserves clarity.",
  description:
    "An independent engineering project by ADGSTUDIOS. Explore a considered approach to card disputes, explainable risk, and human-led decisions.",
  icons: { icon: "/brand/disputeguard-logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  );
}
