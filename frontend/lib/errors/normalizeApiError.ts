export type NormalizedErrorKind = "validation" | "stock" | "server" | "network";

export type FieldErrors = Record<string, string[]>;

export interface NormalizedError {
  kind: NormalizedErrorKind;
  title: string;
  message: string;
  fieldErrors: FieldErrors;
  meta?: Record<string, unknown>;
}

type AnyRecord = Record<string, any>;

function isObject(v: unknown): v is AnyRecord {
  return !!v && typeof v === "object";
}

function safeString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function joinMessageParts(parts: Array<string | undefined | null>): string {
  return parts
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join("\n");
}

function stripJsonish(text: string): string {
  const t = (text || "").trim();
  if (!t) return "";

  // Avoid dumping JSON/objects in UI banners.
  const looksJson =
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"));
  if (looksJson) return "";

  // Common dev/transport strings we never want to show to users
  const lower = t.toLowerCase();
  if (lower.startsWith("api error:")) return "";
  if (lower.startsWith("api ") && lower.includes(":") && (lower.includes("{") || lower.includes("["))) return "";
  if (lower.includes("[object object]")) return "";

  // If it contains a big inline JSON-ish chunk, drop it.
  const hasBraces = t.includes("{") && t.includes("}");
  const hasBrackets = t.includes("[") && t.includes("]");
  if ((hasBraces || hasBrackets) && t.length > 80) return "";

  return t;
}

function pickStatus(err: unknown): number | undefined {
  if (!err) return undefined;

  // Native fetch Response
  if (typeof Response !== "undefined" && err instanceof Response) {
    return err.status;
  }

  // Some code paths throw `new Error("API error: 400")`
  if (err instanceof Error) {
    const m = (err.message || "").match(/\b(\d{3})\b/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 100 && n <= 599) return n;
    }
  }

  if (isObject(err)) {
    if (typeof err.status === "number") return err.status;
    if (isObject(err.response) && typeof err.response.status === "number") return err.response.status;
    if (typeof err.statusCode === "number") return err.statusCode;
  }

  return undefined;
}

function pickPayload(err: unknown): any {
  if (!err) return undefined;

  if (isObject(err)) {
    // Axios-style
    if (isObject(err.response) && "data" in err.response) return (err.response as AnyRecord).data;
    // Custom throws
    if ("data" in err) return (err as AnyRecord).data;
    if ("body" in err) return (err as AnyRecord).body;
    if ("payload" in err) return (err as AnyRecord).payload;
    if ("detail" in err) return (err as AnyRecord).detail;
    if ("errors" in err) return (err as AnyRecord).errors;
  }

  return undefined;
}

function extractTextMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "";

  if (isObject(err)) {
    // Some libs throw { message }
    const m = safeString((err as AnyRecord).message);
    if (m) return m;

    // DRF common keys
    const detail = safeString((err as AnyRecord).detail);
    if (detail) return detail;

    // Sometimes serializer errors come as { non_field_errors: [...] }
    const nfe = (err as AnyRecord).non_field_errors;
    if (Array.isArray(nfe)) {
      const joined = nfe.map((x) => safeString(x)).filter(Boolean).join("\n");
      if (joined) return joined;
    }
  }

  return "";
}

function looksLikeDrfSerializerErrors(payload: any): boolean {
  // DRF serializer errors are usually an object where values are arrays of strings or nested objects.
  if (!isObject(payload)) return false;

  // If it has a clear DRF key.
  if ("non_field_errors" in payload || "detail" in payload) return true;

  // Heuristic: at least one key has an array or nested object.
  return Object.values(payload).some((v) => Array.isArray(v) || isObject(v));
}

function normalizeListToStrings(v: any): string[] {
  if (v == null) return [];
  if (typeof v === "string") return [v];
  if (typeof v === "number" || typeof v === "boolean") return [String(v)];
  if (Array.isArray(v)) {
    return v
      .flatMap((x) => normalizeListToStrings(x))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Flattens DRF serializer errors (including nested objects / list indexes) into dot-path keys.
 * Example: { customer: { phone: ["Invalid"] } } -> { "customer.phone": ["Invalid"] }
 */
export function flattenFieldErrors(apiErr: any): FieldErrors {
  const out: FieldErrors = {};

  const walk = (node: any, path: string) => {
    if (node == null) return;

    if (Array.isArray(node)) {
      // Could be a list of error strings OR list of nested objects
      const asStrings = normalizeListToStrings(node);
      if (asStrings.length) {
        const key = path || "non_field_errors";
        out[key] = (out[key] || []).concat(asStrings);
        return;
      }

      node.forEach((item, idx) => {
        if (isObject(item) || Array.isArray(item)) {
          const nextPath = path ? `${path}[${idx}]` : `[${idx}]`;
          walk(item, nextPath);
        }
      });
      return;
    }

    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
      const key = path || "non_field_errors";
      const msg = String(node).trim();
      if (msg) out[key] = (out[key] || []).concat([msg]);
      return;
    }

    if (isObject(node)) {
      // DRF sometimes returns { detail: "..." }
      if (typeof node.detail === "string" && node.detail.trim()) {
        const key = path || "non_field_errors";
        out[key] = (out[key] || []).concat([node.detail.trim()]);
      }

      Object.entries(node).forEach(([k, v]) => {
        const nextPath = path ? `${path}.${k}` : k;
        walk(v, nextPath);
      });
    }
  };

  walk(apiErr, "");

  // Prefer common DRF key name for non-field errors
  if (out["non_field_errors"] && out["non_field_errors"].length) {
    out["__all__"] = (out["__all__"] || []).concat(out["non_field_errors"]);
    delete out["non_field_errors"];
  }

  // De-dupe messages per field
  for (const k of Object.keys(out)) {
    out[k] = Array.from(new Set(out[k]));
  }

  return out;
}

function applyFieldAliases(fieldErrors: FieldErrors): FieldErrors {
  const alias: Record<string, string> = {
    "customer.cedula": "cedula",
    "document_number": "cedula",
    "customer.phone": "phone",
    "customer.full_name": "full_name",
    "customer.email": "email",
  };

  const out: FieldErrors = {};
  for (const [k, msgs] of Object.entries(fieldErrors || {})) {
    const mapped = alias[k] || k;
    out[mapped] = (out[mapped] || []).concat(msgs || []);
  }

  // De-dupe
  for (const k of Object.keys(out)) {
    out[k] = Array.from(new Set(out[k].map((m) => (m || "").trim()).filter(Boolean)));
  }

  return out;
}

function detectStock(payload: any, message: string): boolean {
  const msg = (message || "").toLowerCase();
  const msgHit =
    msg.includes("stock") ||
    msg.includes("sin stock") ||
    msg.includes("agotad") ||
    msg.includes("out of stock") ||
    msg.includes("no hay disponibilidad") ||
    msg.includes("disponibilidad") ||
    msg.includes("inventario");

  if (msgHit) return true;

  if (isObject(payload)) {
    // Heuristics: stock validation payloads often include items, warnings, or variant IDs.
    if ("warningsByVariantId" in payload) return true;
    if ("warnings" in payload) return true;
    if ("items" in payload) return true;
    if ("out_of_stock" in payload || "outOfStock" in payload) return true;
    if ("stock" in payload) return true;
  }

  return false;
}

function defaultFor(kind: NormalizedErrorKind): Pick<NormalizedError, "title" | "message"> {
  switch (kind) {
    case "validation":
      return {
        title: "Revisa los datos",
        message: "Hay campos con errores. Corrígelos e intenta de nuevo.",
      };
    case "stock":
      return {
        title: "Stock cambió",
        message: "Algunos ítems superan el stock disponible.",
      };
    case "server":
      return {
        title: "Ups…",
        message: "Tuvimos un problema del lado del servidor. Intenta nuevamente en unos minutos.",
      };
    case "network":
    default:
      return {
        title: "Sin conexión",
        message: "No pudimos conectarnos. Revisa tu internet e intenta de nuevo.",
      };
  }
}

/**
 * Convert any error (400/401/403/500, fetch failures, serializer errors) into an UI-friendly shape.
 * Guarantees: message is always human text (never raw JSON), and fieldErrors is always an object.
 */
export function normalizeApiError(err: unknown): NormalizedError {
  const status = pickStatus(err);
  const payload = pickPayload(err);

  // Best-effort message extraction, but never show raw JSON.
  const rawMsg = extractTextMessage(err);
  const payloadDetail = isObject(payload) ? safeString((payload as AnyRecord).detail) : "";
  const payloadMessage = isObject(payload) ? safeString((payload as AnyRecord).message) : "";
  const messageCandidate = stripJsonish(joinMessageParts([payloadDetail, payloadMessage, rawMsg]));

  // Network errors: typically no status/response.
  if (status == null) {
    const base = defaultFor("network");
    return {
      kind: "network",
      title: base.title,
      message: messageCandidate || base.message,
      fieldErrors: {},
      meta: isObject(payload) ? payload : undefined,
    };
  }

  // DRF validation / stock often come as 400.
  if (status === 400) {
    const isStock = detectStock(payload, messageCandidate);
    const kind: NormalizedErrorKind = isStock
      ? "stock"
      : looksLikeDrfSerializerErrors(payload)
      ? "validation"
      : "validation";

    const base = defaultFor(kind);

    const rawFieldErrors = kind === "validation" ? flattenFieldErrors(payload) : {};
    const fieldErrors = kind === "validation" ? applyFieldAliases(rawFieldErrors) : {};

    // Contract: for 400 we always show premium human copy (never raw/technical),
    // and rely on fieldErrors for details.
    const banner = kind === "stock"
      ? base.message
      : Object.keys(fieldErrors || {}).length
      ? "Revisa los campos marcados."
      : base.message;

    return {
      kind,
      title: base.title,
      message: banner,
      fieldErrors,
      meta: isObject(payload) ? payload : undefined,
    };
  }

  // Auth / permissions
  if (status === 401 || status === 403) {
    const base = {
      title: "No autorizado",
      message:
        status === 401
          ? "Tu sesión no es válida o expiró. Vuelve a iniciar sesión e intenta de nuevo."
          : "No tienes permisos para realizar esta acción.",
    };

    return {
      kind: "server",
      title: base.title,
      message: messageCandidate || base.message,
      fieldErrors: {},
      meta: isObject(payload) ? payload : undefined,
    };
  }

  // Server errors
  if (status >= 500) {
    const base = defaultFor("server");
    return {
      kind: "server",
      title: base.title,
      message: base.message,
      fieldErrors: {},
      meta: isObject(payload) ? payload : undefined,
    };
  }

  // Other client errors (404, 409, etc.)
  const base = {
    title: "No se pudo completar",
    message: "Ocurrió un problema al procesar tu solicitud. Intenta de nuevo.",
  };

  return {
    kind: "server",
    title: base.title,
    message: messageCandidate || base.message,
    fieldErrors: {},
    meta: isObject(payload) ? payload : undefined,
  };
}