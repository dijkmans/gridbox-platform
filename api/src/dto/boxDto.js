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

function isUsable(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

function pickFirst(data, paths) {
  for (const p of paths) {
    const v = get(data, p);
    if (isUsable(v)) return v;
  }
  return undefined;
}

function missingRequired(data) {
  const missing = [];

  const site = pickFirst(data, ["Portal.Site", "portal.site", "site.name", "site"]);
  const boxNr = pickFirst(data, ["Portal.BoxNumber", "portal.boxNumber", "box.number", "boxNumber"]);

  if (!isUsable(site)) missing.push("Portal.Site");
  if (!isUsable(boxNr)) missing.push("Portal.BoxNumber");

  return missing;
}

function warnImportant(data) {
  const missing = [];

  const customer = pickFirst(data, [
    "Portal.Customer",
    "portal.customer",
    "organisation.name",
    "organization.name",
    "customer"
  ]);

  if (!isUsable(customer)) missing.push("Portal.Customer");

  return missing;
}

function logMissingIfNeeded(id, data) {
  const required = missingRequired(data);
  const important = warnImportant(data);

  if (!required.length && !important.length) return;

  const topKeys = Object.keys(data || {}).slice(0, 30);

  if (required.length) {
    console.warn(
      `[toBoxDto] Missing REQUIRED fields for box ${id}: ${required.join(", ")}. Top-level keys: ${topKeys.join(", ")}`
    );
  }

  if (important.length) {
    console.warn(
      `[toBoxDto] Missing IMPORTANT fields for box ${id}: ${important.join(", ")}. Top-level keys: ${topKeys.join(", ")}`
    );
  }
}

function normalizePortalCustomer(data) {
  const portal = data?.Portal ?? data?.portal ?? {};
  const existing = portal?.Customer ?? portal?.customer;

  if (isUsable(existing)) return String(existing);

  const orgName = data?.organisation?.name ?? data?.organization?.name;
  if (isUsable(orgName)) return String(orgName);

  const customer = data?.customer;
  if (isUsable(customer)) return String(customer);

  return null;
}

export function toBoxDto(id, data) {
  logMissingIfNeeded(id, data);

  const portalRaw = data?.Portal ?? data?.portal ?? {};

  const Portal = {
    ...portalRaw,
    Customer: normalizePortalCustomer(data)
  };

  return {
    id,

    organisationId: data?.organisationId ?? data?.organizationId ?? null,

    Portal,
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
}
