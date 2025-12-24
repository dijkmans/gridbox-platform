// api/src/dto/boxDto.js

function get(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
    else return undefined;
  }
  return cur;
}

function pickFirst(data, paths) {
  for (const p of paths) {
    const v = get(data, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// Normaliseer keys deep: "street " -> "street"
function normalizeDeep(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(normalizeDeep);

  const out = {};
  for (const k of Object.keys(obj)) {
    const nk = String(k).trim();
    out[nk] = normalizeDeep(obj[k]);
  }
  return out;
}

function requiredMissing(data) {
  const missing = [];

  const site = pickFirst(data, ["Portal.Site", "Portal.Site ", "portal.site", "site.name", "site"]);
  const boxNr = pickFirst(data, ["Portal.BoxNumber", "Portal.BoxNumber ", "portal.boxNumber", "box.number", "boxNumber"]);

  if (site === undefined || site === "") missing.push("Portal.Site");
  if (boxNr === undefined || boxNr === "") missing.push("Portal.BoxNumber");

  return missing;
}

function warnIfMissing(id, data) {
  const missing = requiredMissing(data);
  if (!missing.length) return;

  const topKeys = Object.keys(data || {}).slice(0, 30);
  console.warn(
    `[toBoxDto] Missing required fields for box ${id}: ${missing.join(", ")}. Top-level keys: ${topKeys.join(", ")}`
  );
}

export function toBoxDto(id, data) {
  warnIfMissing(id, data);

  const Portal = normalizeDeep(data?.Portal ?? data?.portal ?? {});

  // box kan nieuw onder Portal.box zitten of legacy onder data.box
  const boxRaw = normalizeDeep(data?.box ?? {});
  const boxFromPortal = normalizeDeep(Portal?.box ?? {});
  const box = Object.keys(boxRaw).length ? boxRaw : boxFromPortal;

  // hardware kan zitten in Portal.box.hardware of box.hardware of data.hardware
  const hardwareCandidate =
    data?.hardware ??
    box?.hardware ??
    Portal?.hardware ??
    Portal?.box?.hardware ??
    {};

  const hardware = normalizeDeep(hardwareCandidate);

  const location = normalizeDeep(data?.location ?? {});
  const lifecycle = normalizeDeep(data?.lifecycle ?? {});
  const organisation = normalizeDeep(data?.organisation ?? data?.organization ?? {});

  // backfill basisvelden indien nodig
  const portalSite = Portal.Site ?? pickFirst(data, ["portal.site", "site.name", "site.code", "site"]);
  if (portalSite !== undefined && Portal.Site === undefined) Portal.Site = portalSite;

  const portalBoxNr = Portal.BoxNumber ?? pickFirst(data, ["portal.boxNumber", "box.number", "boxNumber"]);
  if (portalBoxNr !== undefined && Portal.BoxNumber === undefined) Portal.BoxNumber = portalBoxNr;

  const portalCustomer = Portal.Customer ?? pickFirst(data, ["portal.customer", "organisation.name", "organization.name", "customer"]);
  if (portalCustomer !== undefined && Portal.Customer === undefined) Portal.Customer = portalCustomer;

  return {
    id,

    organisationId: data?.organisationId ?? data?.organizationId ?? null,

    Portal,
    box,
    hardware,

    location,
    lifecycle,
    organisation,

    Agent: data?.Agent ?? data?.agent ?? null,
    Profile: data?.Profile ?? data?.profile ?? null,

    lastSeenMinutes:
      data?.lastSeenMinutes ??
      data?.last_seen_minutes ??
      data?.lastSeen ??
      null
  };
}