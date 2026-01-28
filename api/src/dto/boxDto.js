// api/src/dto/boxDto.js

function toMillis(v) {
  if (!v) return null;
  if (typeof v?.toMillis === "function") return v.toMillis(); // Firestore Timestamp
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function computeLastSeenMinutes(data) {
  const ms =
    (typeof data?.status?.lastSeenMs === "number" ? data.status.lastSeenMs : null) ??
    toMillis(data?.status?.updatedAt) ??
    toMillis(data?.status?.lastSeen) ??
    toMillis(data?.hardware?.hardwareUpdatedAt) ??
    null;

  if (!ms) return null;
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / 60000);
}

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
  const site = normalizeKeys(data?.site ?? {});
  const location = normalizeKeys(data?.location ?? {});
  const lifecycle = normalizeKeys(data?.lifecycle ?? {});
  const ui = normalizeKeys(data?.ui ?? {});
  const organisation = normalizeKeys(data?.organisation ?? data?.organization ?? {});

  return {
    id,

    organisationId: data?.organisationId ?? data?.organizationId ?? null,

    Portal,
    box,
    site,
    location,
    lifecycle,
    ui,
    organisation,

    Agent: data?.Agent ?? data?.agent ?? null,
    Profile: data?.Profile ?? data?.profile ?? null,

    lastSeenMinutes:
      data?.lastSeenMinutes ??
      data?.last_seen_minutes ??
      data?.lastSeen ??
      computeLastSeenMinutes(data) ??
      null,

    // Command intent (desired)
    desired: pickFirst(data, ["desired", "data.desired", "box.desired", "Portal.desired", "portal.desired"]) ?? null,
    desiredAt: pickFirst(data, ["desiredAt", "data.desiredAt", "data.desired_at", "desired_at"]) ?? null,
    desiredBy: pickFirst(data, ["desiredBy", "data.desiredBy", "data.desired_by", "desired_by"]) ?? null,

    // Live status pushed by agent (if present in Firestore)
    status: data?.status ?? null,
    runtime: data?.runtime ?? null,

    // Optional: keep raw data blob if you store things under data.*
    data: data?.data ?? null
  };
}
