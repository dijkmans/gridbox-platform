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
