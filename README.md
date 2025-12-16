Ik hou hierbij expliciet rekening met het Gridbox Master Document v1.2.1 (en opvolgende versies) als vaste referentie en leidend kader. Dit document is officieel en bindend. Afwijkingen alleen na expliciete beslissing en versie-update.

# GRIDBOX MASTER DOCUMENT v1.2.1

Laatste update: 2025-12-17
Status: officieel en bindend kader voor ontwikkeling

Dit document is de officiële en bindende basis voor alles wat met de ontwikkeling van het Gridbox-platform te maken heeft. Bij elke ontwikkelingstaak moet dit document automatisch gevolgd worden.

Afwijkingen zijn enkel toegestaan na expliciete beslissing en versie-update.

## 0. Doel van dit document

Dit document beschrijft de architectuur, modules, regels, routes, datastructuren en ontwikkelafspraken voor het volledige Gridbox-platform.

Het dient als:

* vaste referentie voor product en techniek
* leidraad voor API, portal en IoT
* basis voor testen, support en uitbreiding
* startpunt voor toekomstige teamleden

## 1. Missie en principes

### 1.1 Missie

Gridbox is een slim en modulair lockerplatform waarmee gebruikers pakketten of fietsen kunnen ophalen en binnenbrengen, met toegang via SMS en beheer via een portal. Fysieke toegang gebeurt via een device-laag (Raspberry Pi) die een rolluik en optionele modules aanstuurt (camera, licht, sensoren).

### 1.2 Principes

* SMS-first voor eindgebruikers, geen app verplicht
* Multi-tenant: elke klant ziet alleen eigen data
* Events zijn de waarheid: alles wat gebeurt komt in het logboek
* Modulair: SMS-provider, camera, device-laag moeten vervangbaar blijven
* Veilig by design: strakke afbakening per organisatie, duidelijke rollen

## 2. Rollen en doelgroepen

### 2.1 Eindgebruiker (via SMS)

* Geen portal account
* Krijgt toegang op basis van share of toegangsregel
* Interactie via SMS

### 2.2 Klant (organisatie) via portal

Voorbeeld: PowerGrid.
Kan:

* locaties en boxen bekijken
* manueel open en close doen (indien rechten)
* shares beheren
* events en media bekijken

### 2.3 Interne support (Gridbox)

* Ondersteunt klanten
* Support-acties zijn altijd gelogd

## 3. Kernbegrippen

* Organisatie: klantbedrijf met eigen afbakening (orgId)
* Locatie (site): groep boxen op één plaats
* Box: fysieke Gridbox unit
* Share: toegang gekoppeld aan telefoonnummer
* Gemachtigd: vaste toegang voor personeel, zonder invloed op bezetting of reservatie
* Command: opdracht naar box (open, close, licht)
* Status: actuele toestand (open, dicht, online, error)
* Event: logboekregel van wat er gebeurde
* Sessie: openmoment met bijhorende media
* Media: foto of video gekoppeld aan sessie of alarm

## 4. Architectuur overzicht

### 4.1 Componenten

* Web portal voor klanten
* API backend (Node/Express) op Cloud Run
* Firestore als database
* SMS provider via adapterlaag
* Device layer:

  * Raspberry Pi agent (productie)
  * Simulator agent (ontwikkeling)
* Media storage (bv. Cloud Storage) voor foto’s en video

### 4.2 Hoofdflow

Actie (SMS of portal) maakt command + events. Device voert uit en rapporteert status terug. Camera maakt sessie + media. Alles is zichtbaar in portal via events en sessies.

## 5. Repository structuur (richtlijn)

Monorepo voorbeeld:

* /api

  * /src

    * index.js
    * /routes
    * /services
    * /middleware
    * /adapters
* /web-dashboard
* /device

  * /agent (raspberry)
  * /simulator
* /docs
* /scripts

Afspraken:

* API is ESM (import/export)
* routes zijn dun, services bevatten logica
* adapters voor SMS en media providers

## 6. Klantportal (B2B dashboard)

### 6.1 Doel en scope

De klantportal is een operationeel dashboard voor een organisatie. Doel: eenvoudig beheer van locaties en boxen, shares beheren, events raadplegen, en beelden bekijken.

### 6.2 Schermen en navigatie

#### 6.2.1 Overzicht (Home)

Toont alle locaties met boxkaarten.

Per boxkaart:

* boxnaam en box-id (uniek en duidelijk, bv. “Winkel Bocholt box 1”)
* shutterState: Gesloten, Bezig met openen, Open, Bezig met sluiten, Fout
* online status: Online of Offline (op basis van lastSeenAt, zie 6.4.2)
* lastOpenedAt
* shares samenvatting:

  * tijdelijke shares zichtbaar met telefoonnummer (standaard gemaskeerd)
  * comment zichtbaar
  * vervaldatum of “vervalt binnen X” indien van toepassing
  * badge per share: Actief, Vervallen
  * gemachtigden niet uitschrijven als bezetting, wel teller “Gemachtigd: X”
* knoppen: Open of Close, Events, Shares, Pictures

Bovenaan:

* filter op locatie
* search op boxnaam en site
* search op telefoonnummer alleen voor Admin (zie 6.6)

#### 6.2.2 Shares (per box)

Formulier:

* phone (E.164, bv. +32…)
* comment
* type:

  * tijdelijk
  * gemachtigd (aanvinkvak)
* expiresAt of duur (aanbevolen voor tijdelijke shares)
* Add Share

Lijst:

* createdAt
* phone (standaard gemaskeerd)
* comment
* type of status: Actief, Vervallen, Ingetrokken, Gemachtigd
* Delete (met korte bevestiging)

Regels:

* Tijdelijke share kan reservatie of bezetting beïnvloeden volgens business rules
* Gemachtigd mag nooit bezetting of reservatie beïnvloeden, dit is een harde regel

#### 6.2.3 Events (per box)

Logboek met:

* tijd
* type
* trigger (portal, sms, systeem, device)
* actor (userId of telefoon, afhankelijk van trigger)
* resultaat ok of error (met errorCode en korte fout)

Filters:

* type
* actor
* periode

Regel:

* Alles komt in Events, ook mislukte acties

#### 6.2.4 Pictures (per box)

Toont sessies:

* sessiestart, duur, trigger
* thumbnails van media
* openen of downloaden (optioneel)

Optie:

* foto’s standaard
* video optioneel per klant

### 6.3 Rolluik statusmodel

shutterState:

* CLOSED
* OPENING
* OPEN
* CLOSING
* ERROR

UI regels:

* Tijdens OPENING en CLOSING is de knop disabled en toont UI “bezig”
* Bij ERROR: korte foutmelding + “Probeer opnieuw” (als rechten dit toelaten)

Timing:

* openen ongeveer 20 seconden
* sluiten ongeveer 20 seconden
  De portal vertrouwt op statusupdates, niet op timers.

### 6.4 Online en offline regels

#### 6.4.1 lastSeenAt

lastSeenAt komt alleen van het device (ping of status update).

#### 6.4.2 Offline definitie

Een box is Offline als `now - lastSeenAt > offlineThresholdSeconds`.

Default:

* offlineThresholdSeconds = 180 seconden (3 minuten)

Dit moet per organisatie of per box instelbaar zijn (later via config).

### 6.5 Camera en media regels

#### 6.5.1 Opname bij openen

Wanneer shutterState naar OPEN gaat:

* start een sessie
* neem foto’s elke intervalSeconds (instelbaar per organisatie, bv. 5 of 10)
* blijf opnemen zolang OPEN

Bij sluiten:

* stop sessie na extraAfterCloseSeconds (instelbaar, bv. 15)

#### 6.5.2 Alarm bij beweging terwijl gesloten

Wanneer motion detected en shutterState = CLOSED:

* maak alarm event
* start opname voor korte periode
* koppel media aan alarm-sessie

Notificaties zijn optioneel en later instelbaar.

#### 6.5.3 Bewaartermijn media

Media bewaartermijn is instelbaar per organisatie.

Default in v1.2.1:

* 14 dagen

Cleanup is verplicht (scheduled job), anders groeit dit onbeperkt.

### 6.6 Privacy en telefoonnummers

Telefoonnummers zijn gevoelige data.

Afspraken:

* opslag altijd in E.164 formaat (+32…)
* UI toont standaard gemaskeerd, behalve voor Admin
* zoeken op telefoonnummer alleen voor Admin
* events mogen telefoonnummer bevatten, maar debug logs maskeren standaard

## 7. API ontwerp

### 7.1 Basisregels

* Alle endpoints onder /api
* /api/health bestaat altijd
* JSON in en uit
* Auth verplicht voor portal endpoints
* SMS webhook heeft eigen beveiliging (signature of secret)

### 7.2 Route groepen (richtinggevend)

Nieuwe structuur (voorkeur):

* /api/orgs/{orgId}/sites
* /api/orgs/{orgId}/boxes
* /api/orgs/{orgId}/boxes/{boxId}/shares
* /api/orgs/{orgId}/boxes/{boxId}/events
* /api/orgs/{orgId}/boxes/{boxId}/sessions
* /api/orgs/{orgId}/boxes/{boxId}/media
* /api/orgs/{orgId}/boxes/{boxId}/commands
* /api/sms/inbound (webhook)

Legacy routes mogen tijdelijk blijven bestaan, maar:

* Nieuwe features komen alleen in de nieuwe structuur
* Legacy wordt afgebouwd volgens 7.5

### 7.3 Command flow

1. Portal of SMS vraagt actie aan
2. API maakt command record met status queued
3. API logt event command.open.requested of command.close.requested
4. Device haalt command op of ontvangt command
5. Device voert uit, stuurt status updates
6. API update shutterState en logt events

### 7.4 Device command ophalen

Startaanpak:

* polling interval default 5 seconden
* bij actieve acties mag tijdelijk sneller (bv. 1 seconde) zolang nodig
* long polling is toegestaan als verbetering (device wacht op next command)

We zetten 1 tot 2 seconden polling niet als vaste regel.

### 7.5 Legacy routes afbouw

Afspraken:

* Legacy is read-only of enkel bugfixes
* Elke sprint: minstens 1 legacy endpoint vervangen of verplaatst
* We documenteren wanneer legacy definitief uitgaat, pas na versie-update

## 8. SMS flows

### 8.1 Doel

Eindgebruikers krijgen toegang zonder app.

### 8.2 Basisflow

* inbound SMS komt binnen
* platform normaliseert nummer en tekst
* platform zoekt actieve share of gemachtigde toegang
* platform beslist: open toestaan of weigeren
* platform logt alles in events
* platform stuurt SMS terug met duidelijke tekst

### 8.3 Share regels

* tijdelijke shares kunnen vervallen
* gemachtigd blijft geldig tot ingetrokken
* reminders (bv. “vervalt binnen 1 uur”) zijn systeem events + SMS, optioneel per klant

### 8.4 SMS adapter interface

* sendSms(to, message)
* validateWebhook(request)
* parseInbound(request) -> { from, to, text, receivedAt }

## 9. Firestore datamodel

### 9.1 Belangrijkste wijziging in v1.2.1

We organiseren data onder organizations, zodat multi-tenant security eenvoudiger en veiliger is.

### 9.2 Collecties (voorkeur)

* organizations/{orgId}

  * sites/{siteId}
  * boxes/{boxId}

    * shares/{shareId}
    * events/{eventId}
    * commands/{commandId}
    * sessions/{sessionId}

      * media/{mediaId}
  * users/{userId}
  * config/{configId} of config/global

Als we toch een top-level collectie nodig hebben (bv. device registry), dan alleen met strenge rules en duidelijke reden.

### 9.3 Basisvelden (richtinggevend)

organizations:

* name
* createdAt

sites:

* name
* createdAt

boxes:

* name
* shutterState
* lastSeenAt
* lastOpenedAt
* capabilities
* createdAt

shares:

* phoneE164
* phoneMasked
* comment
* type: temporary of authorized
* status: active, expired, revoked
* createdAt
* expiresAt

commands:

* type
* requestedByType: portal, sms, system
* requestedById: userId of phoneE164
* requestedAt
* status: queued, delivered, executed, failed
* deliveredAt
* executedAt
* errorCode
* errorMessage

events:

* type
* triggerType
* actorType
* actorId
* result: ok or error
* errorCode
* createdAt
* payload (klein houden)

sessions:

* startedAt
* endedAt
* triggerType
* triggerId
* mode: photo of video
* intervalSeconds
* extraAfterCloseSeconds

media:

* createdAt
* kind: photo or video
* url
* meta

### 9.4 Indexen (richtinggevend)

* boxes: order by name, filter per site
* shares: status + expiresAt
* events: createdAt desc
* commands: status + requestedAt
* sessions: startedAt desc

## 10. Event types

### 10.1 Kernset

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
* camera.session.stopped
* alarm.motion.detected
* alarm.recording.started
* alarm.recording.stopped
* error.device.offline
* error.command.failed

### 10.2 Belangrijke afspraak

We loggen niet standaard een event per foto. Foto’s en video’s zijn media records. Alleen sessie start en stop zijn events.

Uitzondering:

* debug mode kan tijdelijk extra events loggen, maar dit is niet standaard.

## 11. Device laag (Raspberry Pi agent)

### 11.1 Taken

* commands uitvoeren (open, close, licht)
* status updates sturen (shutterState, lastSeenAt)
* camera sessies beheren
* motion detectie (optioneel)

### 11.2 Communicatie

Start:

* device haalt commands op (polling of long polling)
* device post status updates naar API

Afspraken:

* status komt van device, portal maakt geen aannames

### 11.3 Autossh en beheer

* remote beheer via autossh tunnel is toegestaan
* deployment via GitHub is ok, maar altijd met versie en rollback mogelijkheid

## 12. Simulator (ontwikkeling zonder Pi)

Doel:

* platform testen zonder hardware

Simulator kan:

* shutter state machine simuleren
* button press simuleren
* events genereren
* camera sessies simuleren met dummy media

Afspraken:

* elke core feature heeft minstens 1 reproduceerbaar simulator scenario

## 13. Media opslag

* media files in storage
* Firestore bewaart metadata + url
* bewaartermijn via cleanup job (default 14 dagen)

## 14. Security

* portal auth met rollen: viewer, operator, admin
* org afbakening verplicht in elke query en in rules
* sms webhook beveiligd (signature of secret)
* support acties altijd gelogd
* debug logs maskeren gevoelige data standaard

## 15. Observability en logging

* API logs voor errors en requests
* functionele waarheid is Events
* aparte error events voor offline en command failures

## 16. Werkwijze en release

### 16.1 Vertical slices

We bouwen per feature volledig af:

* UI
* data
* events
* rechten
* simulator test

### 16.2 Definition of done

Een feature is pas “klaar” als:

* UI duidelijk werkt
* data correct is
* events compleet zijn, ook fouten
* rollen en rechten kloppen
* simulator scenario bestaat

### 16.3 Open punten en beslissingen

#### 16.3.1 Beslissingen (vastgelegd)

Deze punten zijn beslist en gelden als standaard tot een versie-update.

* Firestore structuur is organisatie-gebaseerd: data onder `organizations/{orgId}/...`.
* Device command ophalen: default polling 5 seconden. Sneller mag tijdelijk tijdens een actieve actie. Long polling is toegestaan.
* Events blijven licht: geen standaard event per foto. Alleen sessie start en stop als events. Foto’s en video’s zijn media records.
* Media bewaartermijn default 14 dagen. Cleanup job is verplicht.
* Telefoonnummers: opslaan in E.164, UI standaard maskeren, zoeken op telefoonnummer alleen voor Admin.
* Gemachtigd (authorized) heeft nooit impact op bezetting of reservatie. Dit is een harde regel.
* Offline definitie: offline als `now - lastSeenAt > 180s` (3 minuten) tenzij later per klant of box anders ingesteld.
* Portal camera standaard foto’s. Video is optioneel per klant.
* Nieuwe API features alleen in de nieuwe route-structuur. Legacy alleen bugfix of read-only en wordt afgebouwd.

#### 16.3.2 Open punten (nog te beslissen)

Deze punten mogen gebouwd worden als optie, maar niet hard vastzetten zonder beslissing en versie-update.

* Bezetting logica: wanneer is een box bezet, door welke flow, en hoe resetten we dat betrouwbaar.
* Notificaties: welke kanalen (SMS, mail) en welke triggers (alarm, share vervalt, device offline).
* Video mode: wanneer gebruiken we video in plaats van foto’s, en impact op kosten en opslag.
* Exports: CSV export voor events, shares en sessies, en voor welke rollen.
* Auth aanpak portal: email wachtwoord, magic link, SSO, 2FA.
* Config schermen: waar zetten we per org en per box instellingen (intervalSeconds, extraAfterCloseSeconds, offlineThresholdSeconds, bewaartermijn).
* Alarm motion detectie: welke sensor of methode, en hoe vermijden we valse alarmen.
* Device registry: of we een beperkte top-level collectie nodig hebben, of alles strikt onder org blijft.
* Facturatie en licenties in portal: wat moet zichtbaar zijn voor klanten en wanneer.

## 17. Roadmap (richtinggevend)

Fase 1:

* betrouwbaar open en close
* shares
* events

Fase 2:

* pictures als sessies
* media opslag + cleanup

Fase 3:

* alarm motion while closed
* meldingen

Fase 4:

* instellingen per org en per box
* exports en integraties

## 18. Changelog

v1.2.1 (2025-12-17)

* Firestore model onder organizations gezet als voorkeur voor betere multi-tenant security
* device polling afspraak aangepast: start 5s, sneller alleen tijdelijk, long polling toegestaan
* camera events afgeslankt: sessie start en stop als events, geen standaard event per foto
* media bewaartermijn: default 14 dagen en cleanup verplicht
* privacy regels voor telefoonnummers toegevoegd (E.164, maskeren, zoeken enkel Admin)
* “Gemachtigd” regel verankerd: nooit impact op bezetting of reservatie
* offline definitie vastgelegd via lastSeenAt en threshold (default 3 minuten)
* legacy routes afbouwregels toegevoegd
* sectie 16.3 ingevuld met beslissingen en open punten

v1.2 (2025-12-17)

* Klantportal afspraken vastgelegd
* statusmodel rolluik vastgelegd
* sessie en media regels vastgelegd
* basis event types vastgelegd
