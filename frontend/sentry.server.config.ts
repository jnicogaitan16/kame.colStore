// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { getSentryEnvironment, getSentryRelease } from "./lib/sentry-environment";

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

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
