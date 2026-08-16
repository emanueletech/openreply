import type { MetadataRoute } from "next";

// Rende OpenReply installabile sulla schermata Home dell'iPhone: da Safari,
// Condividi -> "Aggiungi a Home". Si apre a schermo intero, senza barra del
// browser. Non serve nessuno store: è il sito stesso che si presenta come app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenReply",
    short_name: "OpenReply",
    description: "Automazioni da commento a DM per Instagram",
    start_url: "/overview",
    display: "standalone",
    orientation: "portrait",
    background_color: "#18181b",
    theme_color: "#18181b",
    lang: "it",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
