/**
 * Init compartido para Node (RSC, API routes) y Edge (middleware).
 * Se importa desde `instrumentation.ts` según `NEXT_RUNTIME`.
 */
import * as Sentry from "@sentry/nextjs";

import { getSentryEnvironment, getSentryRelease } from "./lib/sentry-environment";
import { scrubSentryEvent } from "./lib/sentry-scrub";

const sentryEnvironment = getSentryEnvironment();
const sentryRelease = getSentryRelease();

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: sentryEnvironment,
  ...(sentryRelease ? { release: sentryRelease } : {}),
  initialScope: (scope) => {
    scope.setTag("environment", sentryEnvironment);
    return scope;
  },
  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubSentryEvent(event as typeof event & Record<string, unknown>);
  },
});
