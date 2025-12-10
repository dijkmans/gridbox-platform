**Ik hou rekening met het Gridbox Master Document.**

Perfecte vraag.
En ja: we kunnen **dit README-document gebruiken als het officiële Gridbox Master Document**, maar dan voegen we er **één cruciale sectie** aan toe:

👉 **het vaste stappenplan waarmee ChatGPT het platform verder ontwikkelt**
Zodat ik *altijd* weet wat de juiste volgende stap is, zonder jouw input te verliezen.

Ik zal het document nu:

1. **omvormen tot het officiële Gridbox Master Document**
2. **jouw README erin integreren**
3. **een vast ontwikkel-stappenplan toevoegen**
4. **het optimaliseren zodat ChatGPT het correct gebruikt als technische basis**

Hieronder staat de **nieuwe definitieve versie**.

---

# 📘 GRIDBOX MASTER DOCUMENT

*Interne architectuur, richtlijnen en ontwikkelvolgorde voor het volledige Gridbox Platform*

---

# 0. Doel van dit document

Dit document dient als:

* vaste technische basis voor **ontwikkeling met ChatGPT**
* leidraad voor backend, frontend en IoT
* referentie voor API-design, mapstructuur en databankmodellen
* stappenplan voor de volledige uitbouw van het Gridbox Platform

ChatGPT moet **bij elke ontwikkelingstaak** met dit document rekening houden.

---

# 1. Projectoverzicht

Het Gridbox Platform is een **monorepo** waarop alle Gridbox-oplossingen worden gebouwd:

* API (Express/Node.js)
* Dashboards (HTML & Next.js)
* IoT-communicatie met Raspberry Pi (WestPiWiPi)
* Multi-tenant login voor bedrijven
* Share- en reserveringssysteem
* Foto’s, logging en planning
* Integratie met WhatsApp bot

Het platform draait in de cloud:

* **API → Google Cloud Run**
* **Frontends → Vercel**
* **Database → Firestore**
* **Foto’s/logs → Cloud Storage**

---

# 2. Monorepo-structuur (vast patroon)

```
gridbox-platform/
│
├── api/
│     ├── src/
│     │    ├── routes/     → API endpoints
│     │    ├── services/   → Businesslogica + Firestore
│     │    └── index.js    → Main server
│     └── Dockerfile       → Cloud Run deploy
│
├── core-frontend/          → HTML-based dashboard (Vercel)
│
├── web-dashboard/          → Next.js bedrijvenportaal (Vercel)
│
├── docs/                   → Architectuur, API-contract, roadmap
│
├── .github/workflows/      → CI/CD pipelines
│
└── README.md               → Documentatie (publiek)
```

---

# 3. API-regels en endpoints

De API gebruikt:

* Node.js
* Express
* JSON-only
* REST style
* `/api/...` prefix
* Clear separation: routes vs business logic

Minimale permanente endpoints:

```
GET  /health
POST /api/auth/login
GET  /api/boxes
GET  /api/boxes/:id
POST /api/boxes/:id/toggle
```

Later:

```
POST /api/reservations
POST /api/shares
GET  /api/companies
POST /api/companies
GET  /api/logs
GET  /api/photos
```

Routes gaan altijd naar:

```
api/src/routes/*.js
```

Businesslogica en Firestore interactie gaan naar:

```
api/src/services/*.js
```

---

# 4. Frontend-regels

### core-frontend

* draait op Vercel
* gebruikt plain HTML, CSS, JS
* snel testen en beheren
* maakt calls naar API_BASE

### web-dashboard

* Next.js (React)
* multi-tenant login
* klantenportaal
* reserveringen, foto’s, logs, planning
* styled volgens definitieve Gridbox-huisstijl

---

# 5. Data modellen

### Box

```
id
number
location
status
lastOpenedText
companyId      (tenant)
```

### Share

```
id
boxId
code
phone
validFrom
validUntil
createdAt
createdBy
```

### Reservation

```
id
boxId
companyId
reservedBy
from
until
status
```

### Company (Tenant)

```
id
name
allowedBoxes[]
users[]
apiKeys[]
branding?
```

---

# 6. WestPiWiPi (Raspberry Pi)

API stuurt commando’s:

```
POST /api/boxes/:id/toggle
```

Pi stuurt terug:

* status
* logs
* camera events
* sensor data

Via HTTP, WebSocket of MQTT.

---

# 7. WhatsApp bot integratie

Bot gebruikt enkel:

```
POST /api/shares
POST /api/reservations
POST /api/boxes/:id/toggle
```

Logica zit volledig in de API.

---

# 8. Hosting & CI/CD

### API

Automatische deploy via GitHub Actions naar Cloud Run.

### Frontend

Vercel met “Root Directory” per frontend:

* `core-frontend`
* `web-dashboard`

---

# 9. Ontwikkelregels

1. Geen logica in frontends.
2. Geen hardware-aansturing rechtstreeks vanuit browsers.
3. Mock data maximaal vervangen door Firestore.
4. Endpoints moeten consistent, voorspelbaar en RESTful zijn.
5. Documentatie in /docs moet blijven groeien.
6. ChatGPT genereert **altijd** code volgens:

   * deze mapstructuur
   * deze API regels
   * deze databankmodellen
   * deze roadmap
7. Firestore integratie gebeurt **pas na** een stabiele API-basis.

---

# 10. VAST STAPPENPLAN VOOR VERDER ONTWIKKELEN

*(Belangrijk — ChatGPT volgt deze stappen automatisch)*

## ⭐ Stap 1 — Basis API volledig operationeel maken

* login
* boxes
* toggle
* Cloud Run deploy
* CORS + JSON parsing
* dashboard koppelen

## ⭐ Stap 2 — Firestore toevoegen

* boxes collectie
* shares collectie
* tenants collectie
* reserveringen collectie

## ⭐ Stap 3 — core-frontend koppelen aan echte data

* DEMO mode uit
* API_BASE → Cloud Run
* real-time box status tonen
* box openen via Pi (mock)

## ⭐ Stap 4 — web-dashboard (Next.js) uitbouwen

* login met tenants
* box management
* reserveringen overzicht
* notificaties

## ⭐ Stap 5 — WestPiWiPi integratie

* Pi ontvangt toggle commands
* Pi stuurt status terug
* Firestore logging
* foto’s uploaden naar Cloud Storage

## ⭐ Stap 6 — WhatsApp bot toevoegen

* shares creëren via API
* reserveringen automatisch aanmaken
* verificatie flow
* logica blijft in de API

## ⭐ Stap 7 — Lancering

* demo accounts
* documentatie
* marketing
* onboarding bedrijven

---

# 11. ChatGPT instructie (belangrijk)

Wanneer dit document aanwezig is volgt ChatGPT **altijd** onderstaande regel:

👉 **ChatGPT moet bij elke Gridbox-taak automatisch rekening houden met dit Master Document, deze mapstructuur, dit API-design en dit stappenplan.**

---

# ✔️ Dit is nu het officiële Gridbox Master Document

Je kunt dit:

* in `/docs/master-document.md` zetten
* of als README.md gebruiken
* of zelfs in GitHub “pinnen” als hoofddocument

**Ik gebruik dit vanaf nu bij elke ontwikkelingstaak binnen dit project.**

---

## Wil je dat ik dit document automatisch omzet naar markdown-bestanden in de juiste map?

Bijvoorbeeld:

* `/docs/architecture.md`
* `/docs/api-richtlijnen.md`
* `/docs/roadmap.md`
* `/docs/master-document.md`

Zeg het maar, dan genereer ik alles volledig klaar om te committen.
