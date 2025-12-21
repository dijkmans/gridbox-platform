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
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function missingRequired(id, data) {
  const missing = [];

  const site = pickFirst(data, ["Portal.Site", "portal.site", "site.name", "site"]);
  const boxNr = pickFirst(data, ["Portal.BoxNumber", "portal.boxNumber", "box.number", "boxNumber"]);

  if (site === undefined || site === "") missing.push("Portal.Site");
  if (boxNr === undefined || boxNr === "") missing.push("Portal.BoxNumber");

  return missing;
}

function logMissingIfNeeded(id, data) {
  const missing = missingRequired(id, data);
  if (!missing.length) return;

  // Zet dit op "1" als je het wil forceren, anders logt hij ook zonder dat (maar je kan dat aanpassen)
  const force = process.env.LOG_DTO_WARN === "1";

  if (force || true) {
    const topKeys = Object.keys(data || {}).slice(0, 30);
    console.warn(
      `[toBoxDto] Missing required fields for box ${id}: ${missing.join(", ")}. Top-level keys: ${topKeys.join(", ")}`
    );
  }
}

export function toBoxDto(id, data) {
  logMissingIfNeeded(id, data);

  // Contract: frontend kijkt alleen naar deze structuur
  // Firestore mag intern veranderen, hier vangen we dat op
  const dto = {
    id,

    organisationId: data?.organisationId ?? data?.organizationId ?? null,

    Portal: data?.Portal ?? data?.portal ?? {},
    box: data?.box ?? {},
    location: data?.location ?? {},
    lifecycle: data?.lifecycle ?? {},
    organisation: data?.organisation ?? data?.organization ?? {},

    Agent: data?.Agent ?? data?.agent ?? null,
    Profile: data?.Profile ?? data?.profile ?? null,

    lastSeenMinutes:
      data?.lastSeenMinutes ??
      data?.last_seen_minutes ??
      data?.lastSeen ??
      null
  };

  return dto;
}
