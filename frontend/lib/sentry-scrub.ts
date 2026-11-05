const FILTERED = "[Filtered]";
const MAX_DEPTH = 12;

const SENSITIVE_KEYS = new Set([
  "password",
  "card_number",
  "cvv",
  "cvc",
  "token",
  "secret",
  "authorization",
  "email",
  "user_email",
  "customer_email",
  "to_email",
  "full_name",
  "first_name",
  "last_name",
  "customer_name",
  "cedula",
  "document_number",
  "document",
  "legal_id",
  "legalid",
  "phone",
  "phone_number",
  "phonenumber",
  "phone_number_prefix",
  "phonenumberprefix",
  "customer_phone",
  "address",
  "customer_address",
  "delivery_notes",
  "notes",
]);

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set_cookie",
  "x_csrftoken",
  "x_api_key",
]);

const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;

function normalizeKey(key: unknown): string {
  return String(key).trim().toLowerCase().replace(/-/g, "_");
}

function isSensitiveKey(key: unknown): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

function isSensitiveHeader(key: unknown): boolean {
  return SENSITIVE_HEADER_KEYS.has(normalizeKey(key));
}

function scrubText(value: string): string {
  return value.replace(EMAIL_RE, FILTERED);
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [key, item] of entries) {
      out[key] = isSensitiveKey(key) ? FILTERED : scrubValue(item, depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    return scrubText(value);
  }

  return value;
}

function scrubRequest(request: Record<string, unknown>): void {
  if ("data" in request) {
    request.data = scrubValue(request.data);
  }
  if ("cookies" in request) {
    request.cookies = FILTERED;
  }
  const headers = request.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(headers as Record<string, unknown>)) {
      next[key] = isSensitiveHeader(key) ? FILTERED : item;
    }
    request.headers = next;
  }
}

export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const request = event.request;
  if (request && typeof request === "object" && !Array.isArray(request)) {
    scrubRequest(request as Record<string, unknown>);
  }

  if (event.extra && typeof event.extra === "object") {
    (event as Record<string, unknown>).extra = scrubValue(event.extra);
  }

  if (event.contexts && typeof event.contexts === "object") {
    (event as Record<string, unknown>).contexts = scrubValue(event.contexts);
  }

  const user = event.user;
  if (user && typeof user === "object" && !Array.isArray(user)) {
    const nextUser = { ...(user as Record<string, unknown>) };
    for (const key of ["email", "ip_address", "username", "name", "geo"]) {
      if (key in nextUser) nextUser[key] = FILTERED;
    }
    (event as Record<string, unknown>).user = nextUser;
  }

  const breadcrumbs = event.breadcrumbs as
    | { values?: Array<Record<string, unknown>> }
    | Array<Record<string, unknown>>
    | undefined;
  const values = Array.isArray(breadcrumbs)
    ? breadcrumbs
    : breadcrumbs && typeof breadcrumbs === "object"
      ? breadcrumbs.values
      : undefined;
  if (Array.isArray(values)) {
    for (const crumb of values) {
      if (typeof crumb.message === "string") {
        crumb.message = scrubText(crumb.message);
      }
      if ("data" in crumb) {
        crumb.data = scrubValue(crumb.data);
      }
    }
  }

  if (typeof event.message === "string") {
    (event as Record<string, unknown>).message = scrubText(event.message);
  }

  return event;
}
