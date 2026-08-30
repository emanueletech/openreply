# Deploy sul NAS UGREEN

Come questa istanza gira in self-hosting, tenuto qui perché finora esisteva **solo sul NAS**: se
quella cartella si fosse persa, l'immagine e lo stack andavano ricostruiti a memoria.

| File | Dove va sul NAS |
|---|---|
| `docker-compose.yaml` | `/volume1/docker/openreply/docker-compose.yaml` — **è il file che Compose legge**, un `.yml` accanto verrebbe ignorato in silenzio |
| `ts-serve.json` | `/volume1/docker/openreply/ts-config/serve.json` — configurazione del Funnel Tailscale, ormai secondario (vedi sotto) |

## Come l'istanza è pubblicata: Cloudflare Tunnel, non più il Funnel

Dal 30/08/2026 l'indirizzo pubblico è **`link.printzone3d.com`**, servito da un container
`cloudflared` nello stack (token in `CLOUDFLARE_TUNNEL_TOKEN`, hostname pubblico configurato in
Cloudflare Zero Trust verso `http://web:3000`, tipo **HTTP**: dentro il tunnel il traffico è già
cifrato e mettere HTTPS darebbe 502).

**Perché non basta più il Funnel di Tailscale.** I nomi `*.ts.net` vengono bloccati da parecchi
filtri DNS, che classificano Tailscale come VPN: il router di casa non li risolveva, e un utente
in Germania ha ricevuto `ERR_NAME_NOT_RESOLVED` aprendo il link di un DM. Il difetto è subdolo
perché **per chi manda i link funziona sempre**: il destinatario semplicemente non apre nulla e
non lo dice. Un dominio proprio non ha questo problema.

`NEXTAUTH_URL` deve puntare al dominio pubblico: è quello che costruisce i link tracciati dei DM
(`lib/tracking/message.ts`). Cambiandolo, riavviare **web e worker** — i link li scrive il worker.

Il Funnel Tailscale resta acceso in parallelo finché i DM già inviati, che contengono il vecchio
indirizzo, hanno esaurito il loro giro. Le due strade convivono senza interferire.

Il `Dockerfile` **non è più qui**: dal 29/08/2026 l'upstream ne pubblica uno alla radice del
repo ([#35](https://github.com/diwenne/openreply/pull/35)), pensato proprio per il self-hosting
— multi-stage, con `wget` e `scripts/` per il servizio cron. Si usa quello: una copia locale
divergente costerebbe un conflitto a ogni merge senza dare nulla in cambio.

Prima di adottarlo è stato provato sul NAS senza toccare la produzione (build in `repo-test`,
poi immagine `openreply-app:test`): Node 20.20, `wget` presente, `scripts/cron.sh` a bordo e
alias `@/…` risolti da `tsx`, che è il punto dove il worker si romperebbe.

L'unica cosa che quel Dockerfile non fa è impostare il fuso: la vecchia immagine aveva
`TZ=Europe/Rome` cucito dentro. Ora **il fuso lo passa il compose** (`TZ` fra le `environment`
dei servizi), verificato che l'immagine lo rispetti.

Questi file **non contengono segreti**: i valori arrivano tutti da `.env`, che resta fuori dal repo
(vedi `.env.example` per l'elenco e a cosa serve ciascuna variabile).

## Quello che il repo non può contenere

`.env` sul NAS ha le chiavi vere. Una in particolare non è sostituibile:

**`ENCRYPTION_KEY` cifra il token Instagram dentro il database.** Un dump SQL contiene il token
cifrato, quindi un ripristino *senza quella chiave* restituisce un database in cui l'account
Instagram non funziona più e va riconnesso da capo via OAuth. Un backup del database senza
`ENCRYPTION_KEY` è un backup incompleto.

Il `.env` va quindi tenuto in una copia cifrata **fuori dal NAS** (archivio AES-256 su un
servizio cloud), insieme al `Dockerfile` e al compose qui sopra. La password va nel gestore di
password: senza, l'archivio non serve a niente.

## Ricostruire lo stack da zero

```bash
# 1. sorgenti (sul NAS non c'è git: si estrae un archivio)
git archive --format=tar.gz -o /tmp/src.tgz HEAD
scp -O /tmp/src.tgz Emanuele@192.168.1.172:/volume1/docker/openreply/
ssh Emanuele@192.168.1.172 'cd /volume1/docker/openreply && tar xzf src.tgz -C repo && rm src.tgz'

# 2. i tre file qui sopra al loro posto, poi il .env ripristinato dalla copia cifrata

# 3. build e avvio
ssh Emanuele@192.168.1.172 'cd /volume1/docker/openreply && docker compose up -d --build'
```

Attenzione al nome del progetto Compose: deve restare **`openreply`**, altrimenti Docker crea
volumi nuovi e vuoti — database azzerato.
