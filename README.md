Ik hou rekening met dit masterdocument  

📘 GRIDBOX MASTER DOCUMENT – v1.1 (definitieve technische blauwdruk)

Dit document is vanaf nu de officiële basis voor alles wat met Gridbox-ontwikkeling te maken heeft.
Bij elke ontwikkelingstaak moet ChatGPT automatisch dit document volgen.

0. Doel van het document

Dit document legt de architectuur, modules, regels, routes, datastructuren en ontwikkelstappen vast voor het volledige Gridbox-platform.

Het dient als:

vaste referentie voor jou

vaste handleiding voor ChatGPT

technisch kader voor API, frontend en IoT

basis voor toekomstige teamleden of partners

1. Missie van Gridbox

Gridbox is een slim en modulair lockerplatform waarmee gebruikers:

pakketten kunnen ophalen/binnenbrengen

toegang krijgen via SMS (Twilio)

fysieke toegang krijgen via Raspberry Pi + relais

camerabeelden laten analyseren via AI

status kunnen bekijken via een dashboard

Gridbox moet:

schaalbaar zijn

betrouwbaar werken op tientallen locaties

eenvoudig uitbreidbaar zijn

gebouwd worden in modules

professioneel beheerbaar zijn

2. Overzicht van architectuur

Gridbox bestaat uit 6 hoofdmodules.

⭐ Module A — Cloud Run API (backend)

Dit is het hart van het systeem.

Verantwoordelijkheden:

alle communicatie met Twilio

alle communicatie met Raspberry Pi’s

camera-uploads verwerken

AI-resultaten verwerken

tenantbeheer

shares beheren

logs en status bijhouden

communicatie naar dashboards

Technologie:

Node.js (Express)

JSON-only

draait in Google Cloud Run

beveiligd via API-keys + Twilio signing

Permanente routes (REST):
GET  /api/health
GET  /api/boxes
GET  /api/boxes/:id
GET  /api/boxes/:id/shares

POST /api/boxes/:id/open     (box openen)
POST /api/boxes/:id/close    (optioneel later)

POST /api/shares
POST /api/sms-webhook
POST /api/camera/analyze     (AI op foto)


❗ Route /toggle verdwijnt definitief.
Het systeem werkt met open en close, niet met toggle.

⭐ Module B — Twilio SMS-module

Doel: gebruikers laten openen via SMS.

Flow:

Gebruiker → SMS → Twilio → /api/sms-webhook → API beslist → Pi opent → camera → AI → bevestiging naar gebruiker


Tijdens ontwikkeling:

Twilio stuurt naar Cloud Run (mock)

API antwoordt met testtekst

Eindfase:

share-validatie

logica

retourbericht

⭐ Module C — Raspberry Pi module

Elke fysieke box heeft een Pi met:

relais (GPIO)

camera

status-sensoren (optioneel)

Pi ontvangt API-commando’s:

POST /open
POST /close
POST /status

Communicatie-faseplan:

Fase 1: HTTP tussen API → Pi (makkelijkste om te starten)
Fase 2: MQTT voor betrouwbaarheid op grotere schaal

⭐ Module D — Camera & AI

Doel:

foto nemen bij open/dicht

foto uploaden

AI bepaalt "leeg" of "vol"

status terugsturen naar API

AI = Google Vision API.

⭐ Module E — Frontend

We maken twee frontends:

1. core-frontend (HTML)

eenvoudige interne interface

gebruikt door jou / techniekers

draait op Vercel

toont API-data

geen login nodig (interne tool)

2. web-dashboard (Next.js)

bedrijvenportaal (multi-tenant)

reserveringen

logs

shares beheren

foto’s bekijken

⭐ Module F — Database

Later fase.

Gebruik:

Firestore (NoSQL)

Collecties:

Boxes
id
location
companyId
status
lastOpened

Shares
id
boxId
code
phone
validFrom
validUntil
createdBy
createdAt

Logs
timestamp
boxId
event
message

CameraPhotos
id
boxId
timestamp
photoUrl
aiResult

3. Projectstructuur (monorepo)

Standaard en verplicht:

gridbox-platform/
│
├── api/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
│
├── core-frontend/
│
├── web-dashboard/
│
├── pi/
│   ├── server.js / server.py
│   ├── gpio.js
│   └── camera.js
│
└── docs/

4. Ontwikkelstrategie (zeer belangrijk)

Je vroeg:

We bouwen module per module. Niet alles moet tijdens de opbouw werken. Pas op het einde moet het geheel werken. Tussenin wel maximaal testen zonder extra software.

Dus het platform wordt in lagen opgebouwd:

FASES:
Fase 1 — API basis

health

mock box data

mock shares

deploy naar Cloud Run

testen met curl

Fase 2 — API routes toevoegen (zonder echte functionaliteit)

alle endpoints aanmaken

mock responses

structuur volledig zetten

Fase 3 — Twilio → API koppeling (mock reply)

enkel verwerken van tekst

nog geen hardware

Fase 4 — Raspberry Pi mock server

Simpele code:

/open → log “open received”

Fase 5 — Raspberry Pi echte relais

GPIO

testopeningen

Fase 6 — Camera mock + echte camera

mock: vaste foto

later echte foto

AI integreren

Fase 7 — E2E Flow

SMS → API → Pi → foto → AI → reply → dashboard update

Fase 8 — Dashboard

pas nu bouwen

koppelen met echte data

5. Communicatieregels

Raspberry Pi bedient nooit rechtstreeks Twilio.

Frontend bedient nooit rechtstreeks Raspberry Pi.

Twilio praat altijd met de API.

API praat altijd met de Pi.

API is de enige bron van waarheid.

Pi voert enkel hardware taken uit.

Dashboard gebruikt enkel de API, nooit de Pi of Twilio.

6. Veiligheid

API-key verplicht voor alle routes behalve sms-webhook

Twilio signing wordt verplicht in productie

Pi endpoints achter beveiliging

geen open poorten extern

data gescheiden per tenant (later fase)

7. Eindresultaat

Een werkend, commercieel platform:

stabiel

schaalbaar

uitbreidbaar

beheersbaar via dashboard

veilig

professioneel

onderhoudbaar

geschikt voor echte klanten

8. ChatGPT-instructie

Bij ELKE Gridbox-ontwikkeling moet ChatGPT automatisch:

dit document volgen

de structuur respecteren

de modules volgen

de fases volgen

nooit routes of architectuur uitvinden die hier niet staan

code genereren die klopt met deze richtlijnen

Dit document is wet binnen dit project.
