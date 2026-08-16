// Frasi pronte da inserire con un clic nei campi del builder, in italiano e in
// inglese. Aggiunta locale: non fa parte di OpenReply originale, quindi un
// aggiornamento della repo non la tocca.
//
// La lingua si sceglie nel builder, campagna per campagna: chi commenta i tuoi
// reel può essere italiano o straniero, e la risposta deve suonare giusta per
// chi la riceve.
//
// Segnaposto: {username} = nome di chi ha commentato, {link} = link tracciato
// (solo nei messaggi DM, mai nelle risposte pubbliche).

export type TipoFrase =
  | "dm"
  | "rispostaPubblica"
  | "dmApertura"
  | "pulsanteApertura"
  | "obbligoFollow"
  | "pulsanteFollow"
  | "followUp"
  | "pulsanteLink";

export type Lingua = "it" | "en";

export const LINGUE: { codice: Lingua; etichetta: string }[] = [
  { codice: "it", etichetta: "Italiano" },
  { codice: "en", etichetta: "English" },
];

export const FRASI_PRONTE: Record<Lingua, Record<TipoFrase, string[]>> = {
  it: {
    dm: [
      "Ciao {username}, eccolo qui 👇",
      "Ciao {username}! Come promesso, ecco il link 👇",
      "Eccoti {username} 🙌 Se hai domande scrivimi pure qui.",
      "Ciao {username}, questo è quello che cercavi. Fammi sapere com'è andata!",
      "Grazie per il commento {username} 💛 Ecco il link che ti serve.",
    ],
    rispostaPubblica: [
      "Ti ho scritto in DM! 📩",
      "Controlla i messaggi 👀",
      "Guarda in chat, te l'ho mandato 📩",
      "Fatto, trovi tutto nei DM ✅",
      "Ti ho appena scritto 🙌",
      "Occhio ai messaggi 😉",
    ],
    dmApertura: [
      "Ciao {username}! Tocca qui sotto e ti mando subito il link 👇",
      "Ehi {username} 👋 Premi il pulsante e te lo giro subito.",
      "Ciao {username}, ci siamo quasi: tocca qui sotto 👇",
    ],
    pulsanteApertura: ["Mandami il link", "Sì, mandamelo", "Lo voglio"],
    obbligoFollow: [
      "Piccolo favore prima di mandarti il link: seguimi, così non ti perdi i prossimi. Quando l'hai fatto tocca il pulsante e te lo mando subito 🙏",
      "Ci vuole un attimo: premi Segui e poi tocca qui sotto, così ti mando il link 💛",
      "Seguimi e tocca il pulsante: il link parte subito 👇",
    ],
    pulsanteFollow: ["Ti seguo già", "Fatto, seguo", "Sto seguendo"],
    followUp: [
      "Grazie per il follow, ci tengo davvero 🙌 Se ti serve altro sono qui.",
      "Ci sei riuscito? Se qualcosa non funziona scrivimi pure 😊",
      "Volevo solo dirti grazie 💛 Se il link ti è stato utile, fammelo sapere!",
    ],
    pulsanteLink: ["Apri il link", "Vai al link", "Guarda qui", "Scoprilo"],
  },

  en: {
    dm: [
      "Hey {username}, here it is 👇",
      "Hi {username}! As promised, here's the link 👇",
      "Here you go {username} 🙌 Any questions, just reply here.",
      "Hey {username}, this is what you were after. Let me know how it goes!",
      "Thanks for commenting {username} 💛 Here's the link you need.",
    ],
    rispostaPubblica: [
      "Just DMed you! 📩",
      "Check your messages 👀",
      "Sent it over, check your DMs 📩",
      "Done, it's in your inbox ✅",
      "Just sent it 🙌",
      "Keep an eye on your DMs 😉",
    ],
    dmApertura: [
      "Hey {username}! Tap below and I'll send the link right over 👇",
      "Hi {username} 👋 Hit the button and it's yours.",
      "Hey {username}, almost there: tap below 👇",
    ],
    pulsanteApertura: ["Send me the link", "Yes, send it", "I want it"],
    obbligoFollow: [
      "Quick favour before I send the link: give me a follow so you don't miss the next ones. Tap the button once you have and I'll send it straight over 🙏",
      "Takes a second: hit Follow, then tap below and the link is yours 💛",
      "Follow me and tap the button — the link goes out right away 👇",
    ],
    pulsanteFollow: ["I'm following", "Done, following", "Already following"],
    followUp: [
      "Thanks for the follow, it genuinely means a lot 🙌 Need anything else, I'm here.",
      "Did it work out? If something's off just message me 😊",
      "Just wanted to say thank you 💛 If the link helped, let me know!",
    ],
    pulsanteLink: ["Open link", "Go to link", "Check it out", "See it"],
  },
};
