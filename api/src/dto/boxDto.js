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

function toMillis(v) {
  try {
    if (!v) return null;


    // number (ms of seconds)
    if (typeof v === "number") {
      // milliseconds since epoch
      if (v > 1e12) return Math.floor(v);
      // seconds since epoch
      if (v > 1e9) return Math.floor(v * 1000);
      return null;
    }

    // Firestore Timestamp
    if (typeof v.toDate === "function") {
      const d = v.toDate();
      return d instanceof Date ? d.getTime() : null;
    }

    // Date
    if (v instanceof Date) return v.getTime();

    // ISO string
    if (typeof v === "string") {
      const t = Date.parse(v);
      return Number.isNaN(t) ? null : t;
    }

    // seconds/nanoseconds object (soms)
    if (typeof v === "object") {
      const sec = v.seconds ?? v._seconds ?? null;
      const nsec = v.nanoseconds ?? v._nanoseconds ?? 0;
      if (sec !== null && sec !== undefined) {
        const ms = Number(sec) * 1000 + Math.floor(Number(nsec || 0) / 1e6);
        return Number.isFinite(ms) ? ms : null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function computeLastSeenMinutes(data) {
  // 1) afleiden uit status timestamps (meest betrouwbaar)
  const ls =
    data?.status?.lastSeenMs ??
    data?.status?.updatedAt ??
    data?.status?.lastSeen ??
    null;

  const ms = toMillis(ls);
  if (ms) {
    const diff = Date.now() - ms;
    if (Number.isFinite(diff)) {
      return Math.max(0, Math.round(diff / 60000));
    }
  }

  // 2) fallback naar bestaande velden als status geen timestamp heeft
  const direct =
    data?.lastSeenMinutes ??
    data?.last_seen_minutes ??
    null;

  const n = Number(direct);
  return Number.isFinite(n) ? n : null;
}

export function toBoxDto(id, data) {
  warnIfMissing(id, data);

  const Portal = normalizeKeys(data?.Portal ?? data?.portal ?? {});
  const box = normalizeKeys(data?.box ?? {});
  const location = normalizeKeys(data?.location ?? {});
  const lifecycle = normalizeKeys(data?.lifecycle ?? {});
  const organisation = normalizeKeys(data?.organisation ?? data?.organization ?? {});

  return {
    id,

    organisationId: data?.organisationId ?? data?.organizationId ?? null,

    Portal,
    box,
    location,
    lifecycle,
    organisation,

    Agent: data?.Agent ?? data?.agent ?? null,
    Profile: data?.Profile ?? data?.profile ?? null,

    lastSeenMinutes: computeLastSeenMinutes(data),

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
