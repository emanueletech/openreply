# Deploy sul NAS UGREEN

Come questa istanza gira in self-hosting, tenuto qui perché finora esisteva **solo sul NAS**: se
quella cartella si fosse persa, l'immagine e lo stack andavano ricostruiti a memoria.

| File | Dove va sul NAS |
|---|---|
| `docker-compose.yaml` | `/volume1/docker/openreply/docker-compose.yaml` — **è il file che Compose legge**, un `.yml` accanto verrebbe ignorato in silenzio |
| `ts-serve.json` | `/volume1/docker/openreply/ts-config/serve.json` — configurazione del Funnel Tailscale, **spento dal 16/09/2026**: tenuto qui per poterlo ricostruire (vedi sotto) |

## Dischi: cosa sta dove (misurato il 17/09/2026)

Il NAS ha un NVMe nuovo come `/volume2`, e il **root di Docker è stato spostato** lì
(`/volume2/@docker`, impostato in `/etc/docker/daemon.json`). Motivo: i dischi meccanici non si
addormentavano mai perché Docker leggeva i suoi layer in continuazione, e il NAS sta in camera.

Cosa è effettivamente sull'NVMe:

| Cosa | Dove | Su cosa |
|---|---|---|
| Immagini, container, **volumi nominati** (`openreply_pgdata`, `_redisdata`, `_tsstate`) | `/volume2/@docker/...` | NVMe ✅ |
| Cartella del progetto: `docker-compose.yaml`, `.env`, `repo/`, `ts-config/`, dump SQL | `/volume1/docker/openreply/` | pool meccanico |

Quindi il database **è già** sull'NVMe (è un volume nominato), ed è quello che scriveva senza
sosta. La cartella del progetto invece si legge solo al build e all'avvio, non a regime.

**I comandi di questo README usano `/volume1/docker/openreply` ed è corretto così.** Verificato
il 17/09/2026: `/volume1/docker` **non è un collegamento** a `/volume2/docker` — sono due cartelle
distinte su due dischi diversi (device 64768 contro 64769, inode diversi, permessi 777 contro 700).
I file vivi — `.env` del 6/09, `repo/` aggiornato dall'ultimo deploy — stanno su `/volume1`, e
`/volume2/docker` non è nemmeno attraversabile dall'utente `Emanuele` (è `drwx------` di root).
Usare `/volume2/docker/openreply` nei comandi darebbe `Permission denied`, e se lì esistesse una
copia del periodo della migrazione, farebbe ripartire lo stack da un `.env` e da sorgenti vecchi.

Se un giorno la cartella del progetto va spostata davvero, l'ordine è: fermare lo stack, spostare
i file, correggere i permessi, ricreare i container (`docker compose up -d`, non `restart`) perché
il bind mount di `ts-config` è inciso nella configurazione del container, e solo allora aggiornare
i percorsi qui.

## Spostare dati sul NAS: `tar`, mai `rsync`

L'`rsync` di UGOS **non preserva i permessi**, senza dare errore nemmeno con `-vv`: un file `444`
copiato con `rsync -a` fra due filesystem diversi arriva `600`, il modo del file temporaneo, come
se il `chmod` finale non avvenisse. `cp -p` e `chmod` invece funzionano. Costata due ore: un root
di Docker copiato così si avvia e poi ogni container muore con `executable file not found in
$PATH` o `permission denied`.

```bash
tar --xattrs --xattrs-include='*' --numeric-owner -cf - sorgente | ( cd destinazione && tar xf - )
```

I permessi viaggiano dentro l'archivio, quindi arrivano interi.

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

Il Funnel Tailscale è rimasto acceso in parallelo per i DM già inviati, che contenevano il vecchio
indirizzo, ed è stato **spento il 16/09/2026** con `docker compose stop tailscale`. Il container e
il volume `openreply_tsstate` restano al loro posto: si riaccende con `start`.

Da spegnere è il Funnel, **mai `cloudflared`**: da lì passano i webhook di Meta, i link di ogni DM
recente e la dashboard. E prima di fermarlo va spostato chi lo usa: il servizio di pubblicazione
aveva `OPENREPLY_URL` su quell'hostname, e senza quel passaggio ogni video sarebbe uscito senza
campagna, in silenzio. I link `…ts.net/r/…` dentro i 38 DM anteriori al 30/08/2026 non si aprono
più: è il prezzo accettato dello spegnimento.
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
scp -O /tmp/src.tgz Emanuele@dxp2800-f339.local:/volume1/docker/openreply/
ssh Emanuele@dxp2800-f339.local 'cd /volume1/docker/openreply && tar xzf src.tgz -C repo && rm src.tgz'

# 2. i tre file qui sopra al loro posto, poi il .env ripristinato dalla copia cifrata

# 3. build e avvio
ssh Emanuele@dxp2800-f339.local 'cd /volume1/docker/openreply && docker compose up -d --build'
```

Attenzione al nome del progetto Compose: deve restare **`openreply`**, altrimenti Docker crea
volumi nuovi e vuoti — database azzerato.
