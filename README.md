# 📘 GRIDBOX MASTER DOCUMENT – v1.2

## Definitieve technische en conceptuele blauwdruk

Dit document is de **officiële en bindende basis** voor alles wat met de ontwikkeling van het Gridbox‑platform te maken heeft.
Bij **elke** ontwikkelingstaak moet dit document automatisch gevolgd worden.

Afwijkingen zijn enkel toegestaan na expliciete beslissing en versie‑update.

---

## 0. Doel van dit document

Dit document legt vast:

* architectuur
* kernconcepten
* modules
* communicatieregels
* datastructuren
* ontwikkelfases
* beslissingslogica

Het dient als:

* vaste referentie voor Gridbox
* vaste handleiding voor ChatGPT
* technisch kader voor API, frontend en IoT
* basis voor teamleden, partners en audits

---

## 1. Missie van Gridbox

Gridbox is een **universeel, modulair en schaalbaar locker‑ en resourceplatform** waarmee organisaties fysieke toegang veilig en flexibel kunnen beheren.

Het platform laat toe om:

* items binnen te brengen of af te halen
* toegang te verlenen via SMS (Twilio)
* fysieke boxen te openen via Raspberry Pi en relais
* camerabeelden te analyseren via AI
* status, logs en gebruik te beheren via dashboards

Gridbox moet:

* betrouwbaar werken op tientallen locaties
* uitbreidbaar zijn zonder herbouw
* scenario‑onafhankelijk blijven
* professioneel beheerd kunnen worden

---

## 2. Architectuuroverzicht

Gridbox bestaat uit **6 hoofdmodules**. Elke module heeft een strikt afgebakende verantwoordelijkheid.

---

### ⭐ Module A — Cloud Run API (backend)

**Het brein van het systeem.**

Verantwoordelijkheden:

* centrale beslissingslogica
* communicatie met Twilio
* communicatie met Raspberry Pi’s
* verwerking van camera‑uploads
* verwerking van AI‑resultaten
* beheer van toegang, bezetting en tijdsvensters
* logging en statusbeheer
* communicatie naar dashboards

Technologie:

* Node.js (Express)
* JSON‑only
* draait op Google Cloud Run

Beveiliging:

* API‑keys voor alle routes
* Twilio request signing

Vaste REST‑routes:

* GET  /api/health

* GET  /api/boxes

* GET  /api/boxes/:id

* GET  /api/boxes/:id/access

* POST /api/boxes/:id/open

* POST /api/boxes/:id/close

* POST /api/access

* POST /api/sms-webhook

* POST /api/camera/analyze

❗ De route `/toggle` bestaat **niet**.
Open en close zijn expliciete acties.

---

### ⭐ Module B — Twilio SMS‑module

Doel:

* gebruikers toegang geven via eenvoudige SMS

Principes:

* Twilio praat **enkel** met de API
* SMS is communicatie, geen beslisser

Flow:
Gebruiker → SMS → Twilio → `/api/sms-webhook` → API beslist → Pi → camera → AI → feedback

Ontwikkelfases:

* mock replies
* parsing
* validatie
* finale logica

---

### ⭐ Module C — Raspberry Pi module

Elke Gridbox bevat een Raspberry Pi met:

* relais (GPIO)
* camera
* optionele sensoren

De Pi:

* voert hardware‑acties uit
* neemt geen beslissingen

Endpoints:

* POST /open
* POST /close
* POST /status

Communicatiestrategie:

* Fase 1: HTTP
* Fase 2: MQTT

---

### ⭐ Module D — Camera & AI

Doel:

* visuele controle en bewijs

Flow:

* foto bij open en dicht
* upload naar API
* AI‑analyse (Google Vision)
* resultaat terug naar API

AI:

* adviserend
* beslist nooit autonoom

---

### ⭐ Module E — Frontend

#### 1. Core‑frontend (HTML)

* intern gebruik
* eenvoudige interface
* draait op Vercel
* geen login

#### 2. Web‑dashboard (Next.js)

* multi‑tenant
* beheer van boxen
* beheer van toegang
* logs en foto’s

Frontends praten **enkel** met de API.

---

### ⭐ Module F — Database

Technologie:

* Firestore (NoSQL)

Collecties:

**Boxes**

* id
* location
* companyId
* status
* lastSeen

**Access**

* id
* boxId
* phone
* validFrom
* validUntil
* accessType (occupying | privileged)
* impactOnOccupancy
* allowedActions

**Commands**

* id
* boxId
* type
* source
* actor
* status
* createdAt

**Events**

* id
* boxId
* type
* source
* actor
* timestamp
* commandId

**CameraPhotos**

* id
* boxId
* eventId
* timestamp
* photoUrl
* aiResult

---

## 3. Kernconcepten

### 3.1 Resource

* een fysieke Gridbox
* inhoud is onbekend voor het platform

### 3.2 Actor

* gebruiker, gsm‑nummer, systeem of knop

### 3.3 Toegang (Access)

Toegang bepaalt **wat mag**, niet wat gebeurt.

Types:

* **Bezettende toegang**: veroorzaakt bezetting
* **Gemachtigde toegang**: geen invloed op bezetting

### 3.4 Tijd

Tijd is een parameter:

* begin
* einde
* marge

Geen aparte reservatie‑engine.

### 3.5 Command

Een intentie.
Kan slagen of mislukken.

### 3.6 Event

De waarheid.
Alles wordt gelogd.

---

## 4. Agenda‑integratie

* Tijd wordt beheerd in het platform
* Google Agenda wordt **gevuld** door het platform
* Agenda is visualisatie en reminder
* Agenda is nooit leidend

---

## 5. Beslissingslogica (samenvatting)

* geplande toegang wordt geactiveerd bij starttijd
* boxkeuze gebeurt last‑minute
* filtering op status, fout en bezetting
* gemachtigde toegang blokkeert niets
* camera optioneel als voorwaarde
* toegang wordt pas actief na boxkeuze

---

## 6. Ontwikkelstrategie

Ontwikkeling gebeurt in **lagen**:

1. API basis
2. API routes (mock)
3. Twilio koppeling (mock)
4. Pi mock server
5. GPIO
6. Camera + AI
7. End‑to‑end flow
8. Dashboards

---

## 7. Communicatieregels

* Pi praat nooit met Twilio
* Frontend praat nooit met Pi
* Twilio praat enkel met API
* API is enige bron van waarheid

---

## 8. Veiligheid

* API‑keys verplicht
* Twilio signing verplicht
* Pi endpoints afgeschermd
* tenant‑scheiding voorzien

---

## 9. Rol van AI

AI is adviserend:

* detecteert patronen
* doet voorstellen
* signaleert afwijkingen

AI beslist nooit autonoom.

---

## 10. Status van dit document

Dit document:

* is bindend
* vervangt alle vorige versies
* is versie 1.2

Wijzigingen gebeuren enkel via expliciete versie‑update.

Ik hou hierbij expliciet rekening met het Gridbox Master Document v1.1 (en opvolgende versies) als vaste referentie en leidend kader.

Hier is een volledig, leesbaar masterdocument als 1 geheel. Ik noem dit v1.2, omdat ik het samenbreng en aanvul met de nieuwe afspraken rond de klantportal (Klantportal v0.1) die we net hebben vastgelegd. Copy paste mag.

# GRIDBOX MASTER DOCUMENT v1.2

Laatste update: 2025-12-17
Status: werkdocument, leidend kader voor ontwikkeling

## 0. Doel van dit document

Dit document is de officiële basis voor alles wat met Gridbox-ontwikkeling te maken heeft. Het beschrijft de architectuur, modules, regels, routes, datastructuren en ontwikkelstappen voor het volledige Gridbox-platform.

Het dient als:

* vaste referentie voor jou
* vaste handleiding voor ontwikkeling
* technisch kader voor API, portal en IoT
* basis voor toekomstige teamleden of partners

## 1. Missie van Gridbox

Gridbox is een slim en modulair lockerplatform waarmee gebruikers:

* pakketten of fietsen kunnen ophalen en binnenbrengen
* toegang krijgen via SMS (SMS-first)
* fysieke toegang krijgen via een Raspberry Pi die het rolluik en eventueel licht en sensoren aanstuurt
* camera-opnames kunnen raadplegen bij openmomenten of alarmsituaties
* status en logs kunnen bekijken via een portal

Belangrijke principes:

* SMS-first: geen app nodig voor eindklanten
* multi-tenant: elke klant ziet enkel zijn eigen boxen en data
* alles is gelogd: events zijn de “waarheid”
* modulair: SMS-provider, camera, device-laag moeten vervangbaar zijn

## 2. Rollen en doelgroepen

### 2.1 Eindklant (gebruiker)

* krijgt toegang via SMS om een box te openen
* hoeft geen account in de portal

### 2.2 Klant (organisatie)

Voorbeeld: PowerGrid.
Dit is het bedrijf dat Gridbox gebruikt en de portal gebruikt om boxen te beheren:

* locaties en boxen bekijken
* openen en sluiten manueel (indien rechten)
* shares beheren (toegang geven)
* events en media bekijken

### 2.3 Interne support (Gridbox team)

* kan debuggen en ondersteunen
* acties zijn altijd gelogd

## 3. Kernconcepten en definities

* Organisatie: klantbedrijf met eigen data-afbakening
* Locatie (site of groep): bv. Heist, Winkel Bocholt, Winkel Mol, Winkel Geel
* Box: één fysieke unit met rolluik, camera, eventueel licht en sensoren
* Share: toegang gekoppeld aan telefoonnummer
* Gemachtigd: vaste toegang voor personeel, telt niet als bezetting of reservatie
* Command: opdracht naar een box (open, close, licht)
* Status: huidige toestand van box (open, dicht, online, error)
* Event: logboekregel van wat er gebeurde
* Sessie: openmoment van de box met bijhorende foto’s of video
* Media: foto’s of video’s

## 4. Architectuur overzicht

### 4.1 Componenten

* Web portal (dashboard) voor klanten
* API backend (Node/Express) op Cloud Run
* Database: Firestore
* SMS provider (wisselbaar via adapter)
* Device layer:

  * Raspberry Pi agent (productie)
  * Simulator agent (ontwikkeling en tests zonder Pi)
* Storage voor media (bv. cloud storage) of een vergelijkbare oplossing

### 4.2 Hoofdflow in 1 zin

Een actie (SMS of portal) maakt een command en events, het device voert uit, rapporteert status terug, camera maakt sessie en media, alles komt in events en is zichtbaar in de portal.

## 5. Repository structuur (richtlijn)

Monorepo, voorbeeld:

* /api

  * /src

    * index.js
    * /routes
    * /services
    * /middleware
    * /adapters
* /web-dashboard

  * portal UI
* /device

  * raspberry agent
  * simulator
* /docs

  * master document
  * technische notities
* /scripts

  * tooling, deployment helpers

Afspraak:

* API is ESM (import/export)
* routes zijn klein en roepen services aan
* Firestore logica zit in services
* adapters voor SMS en media zodat we providers kunnen wisselen

## 6. Klantportal (B2B dashboard)

### 6.1 Doel en scope

De klantportal is de webomgeving voor een klant die het Gridbox-platform gebruikt (bv. PowerGrid). De klant ziet alle locaties en Gridboxen in 1 overzicht, kan boxen manueel openen en sluiten (als zijn rechten dat toelaten), kan toegang delen via telefoonnummer, kan een logboek raadplegen (Events) en kan beelden bekijken (Pictures).

De portal is bedoeld als operationeel dashboard, niet als technische tool. Alles moet duidelijk en eenvoudig blijven.

### 6.2 Begrippen

* Organisatie (klant): bedrijf dat toegang heeft tot het platform
* Locatie (site of groep): bv. Heist, Winkel Bocholt, Winkel Mol, Winkel Geel
* Box: één fysieke Gridbox (bv. #3, #4)
* Share: toegang gekoppeld aan een telefoonnummer
* Gemachtigd: vaste toegang voor personeel of chauffeur, zonder invloed op bezetting of reservatie
* Event: logboekregel van wat er gebeurde (open, share, fout, camera, alarm)
* Sessie: periode waarin de box open stond, met bijhorende foto’s of video
* Media: foto’s of video’s gekoppeld aan een sessie of alarm

### 6.3 Schermen en navigatie

#### 6.3.1 Overzichtsscherm (Home)

Toont alle locaties met hun boxen.

Per boxkaart:

* Boxnaam en box-id (bv. “Winkel Bocholt #3”)
* Status rolluik: Gesloten, Bezig met openen, Open, Bezig met sluiten, Fout
* Online status: Online of Offline (op basis van lastSeen)
* Last opened: laatste moment dat box open ging
* Shares samenvatting:

  * tijdelijke shares zichtbaar met telefoonnummer
  * comment zichtbaar (kort)
  * vervaldatum of “vervalt binnen X” indien van toepassing
  * badge per share: Actief, Vervallen, Gemachtigd
  * gemachtigden tonen als teller: “Gemachtigd: X”
* Acties:

  * knop Open of Close (afhankelijk van status)
  * knop Events
  * knop Shares
  * knop Pictures

Bovenaan:

* Filter op locatie (dropdown “Alle groepen”)
* Zoekveld: zoeken op boxnaam, site of telefoonnummer

#### 6.3.2 Shares scherm (per box)

Formulier:

* Phone number (+32…)
* Comment (bv. Afhaling, Oplader, Chauffeur, Onderhoud)
* Type: Tijdelijke share of Gemachtigd (checkbox)
* Vervaldatum of duur (aanbevolen)
* Add Share

Lijst:

* Timestamp
* Phone number
* Comment
* Status: Actief, Vervallen, Ingetrokken, Gemachtigd
* Delete (met korte bevestiging)

Regels:

* Tijdelijke share kan reservatie of bezetting beïnvloeden (business rules)
* Gemachtigd beïnvloedt reservatie of bezetting niet
* Gemachtigd is zichtbaar als teller op het overzicht

#### 6.3.3 Events scherm (per box)

Toont per event:

* Tijd
* Type
* Trigger (portal, sms, systeem, device)
* Actor
* Resultaat ok of error

Filters:

* Type
* Actor (telefoon)
* Periode

Regel:

* Alles komt in Events, ook mislukte acties.

#### 6.3.4 Pictures scherm (per box)

Sessies:

* sessiestart, duur, trigger
* thumbnails
* optioneel download
* video optioneel (per klant instelbaar)

### 6.4 Rolluik statusmodel

shutterState:

* CLOSED
* OPENING
* OPEN
* CLOSING
* ERROR

UI regels:

* OPENING en CLOSING: knop disabled en “bezig”
* ERROR: korte foutmelding en “Probeer opnieuw”

### 6.5 Camera en media regels

Opname bij openen:

* start sessie wanneer box OPEN wordt
* neem foto’s elke X seconden (instelbaar per klant)
* stop bij sluiten + extra n seconden (instelbaar)

Alarm bij beweging terwijl gesloten:

* motion detected terwijl CLOSED
* event “alarm”
* start opname voor korte periode
* media koppelen aan alarm-sessie
* notificatie later optioneel

Bewaartermijn:

* instelbaar per organisatie, voorstel 30 dagen

### 6.6 Rechten en rollen

Rollen:

* Viewer
* Operator
* Admin
* Support (intern, gelogd)

Rechten:

* Open/Close: Operator of Admin
* Shares beheren: Operator of Admin
* Instellingen: Admin

### 6.7 Data entiteiten (logische structuur)

Minimale entiteiten:

* organizations, sites, boxes, shares, events, commands, sessions, media

Belangrijk:

* orgId als basisfilter op alles
* alles wat gebeurt maakt events

### 6.8 Event types (minimum set)

* command.open.requested
* command.open.sent
* shutter.opening
* shutter.opened
* command.close.requested
* command.close.sent
* shutter.closing
* shutter.closed
* share.created
* share.deleted
* share.expired
* camera.session.started
* camera.photo.captured
* camera.session.stopped
* alarm.motion.detected
* alarm.recording.started
* alarm.recording.stopped
* error.device.offline
* error.command.failed

### 6.9 Ontwikkelstrategie

We bouwen per feature volledig af: UI + data + events + simulator test.

Volgorde:

* login en multi-tenant
* open/close statusmodel + events
* shares met verval + badges
* pictures per sessie
* alarm motion while closed
* instellingen per klant en per box

## 7. API ontwerp (backend)

### 7.1 Basisregels

* Alle endpoints onder /api
* Healthcheck: /api/health
* JSON in en uit
* Auth verplicht voor portal endpoints
* Webhooks (SMS) hebben eigen beveiliging (signature of secret)

### 7.2 Route groepen (richtinggevend)

* /api/health
* /api/devices (device registratie en status)
* /api/commands (create en ophalen van commands)
* /api/status (current status per box)
* /api/config (config per box of per org)
* /api/events (events query)
* /api/shares (shares beheer)
* /api/media (lijsten van sessies en media)
* /api/sms (inbound SMS webhook)

Legacy routes kunnen bestaan (bv. /api/boxes), maar het doel is naar bovenstaande structuur te evolueren.

### 7.3 Command flow (kern)

1. Portal of SMS vraagt actie aan (open of close)
2. API maakt command record aan met status queued
3. API logt event command.*.requested
4. Device haalt command op (polling of push)
5. Device voert uit, stuurt status updates
6. API logt events en update shutterState

### 7.4 Status regels

* lastSeenAt komt van device pings
* lastOpenedAt komt van shutter opened event
* shutterState komt van device updates (niet gokken op basis van timers)

## 8. SMS flows (SMS-first)

### 8.1 Doel

Eindklant moet zonder app toegang krijgen.

### 8.2 Basisflow

* klant stuurt SMS naar boxnummer of platformnummer
* platform herkent telefoonnummer en kijkt naar actieve share
* platform beslist wat mag: open, geen toegang, of foutmelding
* platform logt alles in events

### 8.3 Share regels

* tijdelijke share: kan vervallen
* gemachtigd: personeel of chauffeur, geen impact op bezetting
* reminders kunnen later: “vervalt binnen 1 uur” is een systeem event + sms

### 8.4 SMS provider adapter

De SMS provider moet vervangbaar zijn. We werken met een adapterlaag:

* sendSms(to, message)
* validateWebhook(request)
* normaliseer inbound message (from, to, text, timestamp)

## 9. Firestore datamodel (concreet voorstel)

Collecties (voorstel):

* organizations/{orgId}
* sites/{siteId}
* boxes/{boxId}
* shares/{shareId}
* commands/{commandId}
* events/{eventId}
* sessions/{sessionId}
* media/{mediaId}
* users/{userId} (portal accounts)

Basisvelden:

* organizations: name, createdAt
* sites: orgId, name
* boxes: orgId, siteId, name, shutterState, lastSeenAt, lastOpenedAt, capabilities
* shares: orgId, boxId, phone, comment, type, createdAt, expiresAt, status
* commands: orgId, boxId, type, requestedBy, requestedAt, status, deliveredAt, executedAt, error
* events: orgId, boxId, type, actorType, actorId, result, errorCode, createdAt, payload
* sessions: orgId, boxId, startedAt, endedAt, triggerType, triggerId
* media: orgId, boxId, sessionId, createdAt, kind, url, meta

Indexen (richtinggevend):

* boxes by orgId + siteId
* shares by orgId + boxId + status
* events by orgId + boxId + createdAt
* commands by boxId + status + requestedAt
* sessions by boxId + startedAt

## 10. Device laag (Raspberry Pi agent)

### 10.1 Taken

* uitvoeren van commands (open, close, licht)
* rapporteren van status (shutterState, lastSeenAt)
* camera sessies starten en stoppen
* motion detectie (optioneel) voor alarm

### 10.2 Communicatie

Eerste voorkeur voor eenvoud:

* device pollt commands (bv. elke 1 tot 2 seconden) wanneer online
* device stuurt status updates terug via API
* device stuurt events terug of API maakt events op basis van updates

Later kan realtime (websocket of pubsub), maar polling is prima voor start.

### 10.3 Rolluik timing

* openen ongeveer 20 seconden
* sluiten ongeveer 20 seconden
  Belangrijk: status komt van device, niet van timers in portal.

### 10.4 Autossh en beheer

* device is: autossh tunnel voor remote access
* device code via GitHub beheren is ok, maar deployment moet gecontroleerd (versies, rollback)

## 11. Simulator (ontwikkeling zonder Pi)

Doel:

* alles testen zonder echte hardware

Simulator kan:

* shutter state machine simuleren (OPENING, OPEN, CLOSING)
* knop indrukken simuleren
* events genereren
* camera sessies simuleren met dummy media

Afspraak:

* elke core feature heeft minstens 1 simulator test scenario (zie sectie 6.10)

## 12. Media opslag

Media is zwaar. Richtlijn:

* media zelf in storage
* in Firestore enkel metadata en URL

Structuur:

* per box, per sessie mappen of prefix
* bewaartermijn via scheduled cleanup job

## 13. Security

* Portal auth met rollen (viewer, operator, admin)
* Org afbakening is verplicht in elke query
* Webhook beveiliging voor SMS (signature of secret)
* Logging van support acties
* Geen gevoelige data in logs (mask telefoonnummers in debug)

## 14. Observability en logging

* API logs: requests, errors
* events zijn functionele logs voor de klant
* aparte error events voor device offline en command failed

## 15. Release en versiebeheer

* versie tags voor API en portal
* changelog in docs
* “definition of done” per feature (UI, data, events, rechten, simulator test)

## 16. Roadmap (richtinggevend)

Fase 1: betrouwbaar open en close + shares + events
Fase 2: pictures als sessies + basis opslag en bewaartermijn
Fase 3: alarm motion while closed + meldingen
Fase 4: per klant instellingen + exports + integraties

## 17. Changelog

v1.2 (2025-12-17)

* Klantportal sectie toegevoegd en verankerd als leidend kader
* statusmodel rolluik vastgelegd
* sessie en media regels vastgelegd
* basis datamodel en event types vastgelegd

---

Als je wil, kan ik dit ook als netjes opgemaakt Word document of PDF zetten zodat je het makkelijker kan lezen en delen.

