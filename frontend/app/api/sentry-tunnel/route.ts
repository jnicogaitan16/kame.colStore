import { NextResponse } from "next/server";

const ENVELOPE_CONTENT_TYPE = "application/x-sentry-envelope";
const SENTRY_API_VERSION = "7";

/** Proxy de envelopes en dev: evita bloqueo de `*.ingest.sentry.io` en el navegador. */
function ingestUrlFromDsn(dsn: string): string | null {
  const trimmed = dsn.trim();
  const m = /^https:\/\/([^@]+)@([^/]+)\/([^/?]+)$/.exec(trimmed);
  if (!m) return null;
  const [, publicKey, host, projectId] = m;
  const qs = new URLSearchParams({
    sentry_version: SENTRY_API_VERSION,
    sentry_key: publicKey,
  });
  return `https://${host}/api/${projectId}/envelope/?${qs.toString()}`;
}

function forwardSentryResponseHeaders(upstream: Response): Headers {
  const out = new Headers();
  const rateLimits = upstream.headers.get("X-Sentry-Rate-Limits");
  if (rateLimits) out.set("X-Sentry-Rate-Limits", rateLimits);
  const retryAfter = upstream.headers.get("Retry-After");
  if (retryAfter) out.set("Retry-After", retryAfter);
  return out;
}

export async function POST(req: Request) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const ingest = dsn ? ingestUrlFromDsn(dsn) : null;
  if (!ingest) {
    return NextResponse.json({ error: "Sentry DSN no configurado" }, { status: 503 });
  }

  const body = await req.text();
  if (!body.length) {
    return NextResponse.json({ error: "Cuerpo vacío" }, { status: 400 });
  }

  const upstream = await fetch(ingest, {
    method: "POST",
    body,
    headers: { "Content-Type": ENVELOPE_CONTENT_TYPE },
  });

  return new NextResponse(null, {
    status: upstream.status,
    headers: forwardSentryResponseHeaders(upstream),
  });
}
