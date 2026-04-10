/**
 * Valor único de `environment` para Sentry en todo el frontend Next (browser, server, edge).
 * Orden: NEXT_PUBLIC_ENV → NEXT_PUBLIC_DJANGO_ENV (espejo de DJANGO_ENV) → VERCEL_ENV → NODE_ENV.
 */
export function getSentryEnvironment(): string {
  const fromPublic = process.env.NEXT_PUBLIC_ENV?.trim();
  if (fromPublic) return fromPublic;

  const fromDjangoMirror = process.env.NEXT_PUBLIC_DJANGO_ENV?.trim();
  if (fromDjangoMirror) return fromDjangoMirror;

  const vercel = process.env.VERCEL_ENV;
  if (vercel) return vercel;

  return process.env.NODE_ENV || "production";
}

/**
 * Release opcional (ayuda a Sentry a correlacionar issues; en Vercel suele ser el commit).
 * Solo se envía si alguna variable está definida, para no cambiar el comportamiento actual.
 */
export function getSentryRelease(): string | undefined {
  const r =
    process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  return r || undefined;
}
