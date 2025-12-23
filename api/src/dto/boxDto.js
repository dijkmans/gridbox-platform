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

// Normaliseer keys: "street " -> "street"
function normalizeKeys(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    out[String(k).trim()] = obj[k];
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

  const Portal = normalizeKeys(data?.Portal ?? data?.portal ?? {});
  const box = normalizeKeys(data?.box ?? {});
  const location = normalizeKeys(data?.location ?? {});
  const lifecycle = normalizeKeys(data?.lifecycle ?? {});
  const organisation = normalizeKeys(data?.organisation ?? data?.organization ?? {});

  // Nieuw: deze velden doorgeven aan de portal zodat de knop correct kan werken op status.desired
  // en de UI info kan tonen op basis van state/status zonder te gokken.
  const status = normalizeKeys(data?.status ?? {});
  const state = normalizeKeys(data?.state ?? {});
  const ui = normalizeKeys(data?.ui ?? {});

  return {
    id,

    organisationId: data?.organisationId ?? data?.organizationId ?? null,

    Portal,
    box,
    location,
    lifecycle,
    organisation,

    // Nieuw
    status,
    state,
    ui,

    Agent: data?.Agent ?? data?.agent ?? null,
    Profile: data?.Profile ?? data?.profile ?? null,

    lastSeenMinutes:
      data?.lastSeenMinutes ??
      data?.last_seen_minutes ??
      data?.lastSeen ??
      null
  };
}
