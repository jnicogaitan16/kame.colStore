import * as Sentry from "@sentry/nextjs";

import { getSentryEnvironment, getSentryRelease } from "./lib/sentry-environment";

// Next.js 14.2 no carga este archivo en el cliente; el init real del storefront está en
// `components/SentryBrowserInit.tsx`. Se mantiene para Next 15.3+ o builds que sí invoquen el client hook.

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
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [Sentry.replayIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
