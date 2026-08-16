import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenReply - Automazioni da commento a DM per Instagram",
  description:
    "Alternativa a ManyChat, gratuita e self-hosted. Invia un DM su Instagram in automatico quando qualcuno commenta una parola chiave sotto un post o un reel, usando l'API ufficiale di Meta.",
  keywords: [
    "automazione instagram",
    "da commento a DM",
    "risposte private instagram",
    "alternativa manychat",
  ],
  // Installazione sulla schermata Home dell'iPhone
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "OpenReply",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  // niente zoom involontario sui campi di testo dell'iPhone
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full dark">
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
