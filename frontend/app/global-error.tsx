"use client";

import NextError from "next/error";

/**
 * Error global del App Router. Sin import de @sentry/nextjs aquí: en el análisis de
 * dependencias webpack seguía resolviendo el entry servidor (Prisma/OpenTelemetry).
 * Los errores de rutas normales siguen reportándose vía Sentry en layout/error boundaries.
 */
export default function GlobalError({
  error: _error,
}: {
  error: Error & { digest?: string };
}) {

  return (
    <html lang="es">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
