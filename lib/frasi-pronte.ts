// Frasi pronte in italiano da inserire con un clic nei campi del builder.
// Aggiunta locale: non fa parte di OpenReply originale, quindi un aggiornamento
// della repo non la tocca. Per cambiarle basta modificare questo file.
//
// Segnaposto disponibili: {username} = nome di chi ha commentato,
// {link} = link tracciato (solo nei messaggi DM, non nelle risposte pubbliche).

export type TipoFrase =
  | "dm"
  | "rispostaPubblica"
  | "dmApertura"
  | "pulsanteApertura"
  | "obbligoFollow"
  | "pulsanteFollow"
  | "followUp"
  | "pulsanteLink";

export const FRASI_PRONTE: Record<TipoFrase, string[]> = {
  // Il DM che contiene il link
  dm: [
    "Ciao {username}, eccolo qui 👇",
    "Ciao {username}! Come promesso, ecco il link 👇",
    "Eccoti {username} 🙌 Se hai domande scrivimi pure qui.",
    "Ciao {username}, questo è quello che cercavi. Fammi sapere com'è andata!",
    "Grazie per il commento {username} 💛 Ecco il link che ti serve.",
  ],

  // La risposta pubblica sotto al commento: più varianti = non sembra un bot
  rispostaPubblica: [
    "Ti ho scritto in DM! 📩",
    "Controlla i messaggi 👀",
    "Guarda in chat, te l'ho mandato 📩",
    "Fatto, trovi tutto nei DM ✅",
    "Ti ho appena scritto 🙌",
    "Occhio ai messaggi 😉",
  ],

  // Il primo messaggio, quello che apre la conversazione
  dmApertura: [
    "Ciao {username}! Tocca qui sotto e ti mando subito il link 👇",
    "Ehi {username} 👋 Premi il pulsante e te lo giro subito.",
    "Ciao {username}, ci siamo quasi: tocca qui sotto 👇",
  ],
  pulsanteApertura: ["Mandami il link", "Sì, mandamelo", "Lo voglio"],

  // Il messaggio di chi non ti segue ancora
  obbligoFollow: [
    "Piccolo favore prima di mandarti il link: seguimi, così non ti perdi i prossimi. Quando l'hai fatto tocca il pulsante e te lo mando subito 🙏",
    "Ci vuole un attimo: premi Segui e poi tocca qui sotto, così ti mando il link 💛",
    "Seguimi e tocca il pulsante: il link parte subito 👇",
  ],
  pulsanteFollow: ["Ti seguo già", "Fatto, seguo", "Sto seguendo"],

  // Il messaggio che arriva dopo, a cose fatte
  followUp: [
    "Grazie per il follow, ci tengo davvero 🙌 Se ti serve altro sono qui.",
    "Ci sei riuscito? Se qualcosa non funziona scrivimi pure 😊",
    "Volevo solo dirti grazie 💛 Se il link ti è stato utile, fammelo sapere!",
  ],

  // L'etichetta del pulsante che contiene il link
  pulsanteLink: ["Apri il link", "Vai al link", "Guarda qui", "Scoprilo"],
};
