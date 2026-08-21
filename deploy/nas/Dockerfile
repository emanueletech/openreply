# OpenReply — immagine unica per web app e worker (NAS UGREEN, Debian 12 / Docker 29)
# Node 24: Prisma 7 e Next.js 16 richiedono >= 20.19 / 22.12 / 24 (vedi docs/deploy-dokploy.md)
FROM node:24-alpine

# openssl serve a Prisma; tzdata per gli orari corretti nei log
RUN apk add --no-cache openssl tzdata
ENV TZ=Europe/Rome

WORKDIR /app

# Dipendenze complete (dev incluse): servono "next build" per il web e "tsx" per il worker
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Valore fittizio solo per il build: Prisma vuole la variabile presente anche se non
# si connette. A runtime viene sovrascritto dal compose.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1

# prisma generate + next build. Le migrazioni NON vanno qui: al build il DB non
# e' raggiungibile (gotcha #3 di docs/deploy-dokploy.md), girano allo start del web.
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
