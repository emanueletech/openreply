import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { DEFAULT_LOCALE } from "@/lib/i18n";
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
  width: "device-width",
  initialScale: 1,
  // Installed on iOS the app owns the full screen, notch included; the safe
  // area insets below keep content clear of the system UI.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The fork default, not the cookie: reading cookies() here would opt every
    // static page out of prerendering. I18nProvider corrects the attribute
    // client-side for a reader who picked another language.
    <html lang={DEFAULT_LOCALE} className="h-full dark">
      <body
        className="min-h-full bg-background text-foreground font-sans antialiased"
        // Clears the home indicator when installed; 0 everywhere else.
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
