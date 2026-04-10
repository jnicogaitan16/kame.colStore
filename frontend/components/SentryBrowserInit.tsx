"use client";

import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import type { Event, EventHint, Primitive } from "@sentry/core";

import { getSentryEnvironment, getSentryRelease } from "@/lib/sentry-environment";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";
const sentryEnvironment = getSentryEnvironment();
const sentryRelease = getSentryRelease();

/** Siempre el mismo valor en `event.environment` y tag (evita vacíos o merges raros del SDK). */
function patchEventEnvironment(event: Event) {
  event.environment = sentryEnvironment;
  if (!event.tags) event.tags = {};
  (event.tags as { [key: string]: Primitive }).environment = sentryEnvironment;
}

function withPatchedEnvironment<E extends Event>(
  event: E,
  hint: EventHint
): E | null {
  void hint;
  patchEventEnvironment(event);
  return event;
}

function applyEnvironmentTags() {
  Sentry.setTag("environment", sentryEnvironment);
  Sentry.getIsolationScope().setTag("environment", sentryEnvironment);
  Sentry.getGlobalScope().setTag("environment", sentryEnvironment);
}

/**
 * Init del SDK en el navegador (Next 14). Server/edge cargan `sentry.runtime.config` vía instrumentation.
 */
export default function SentryBrowserInit() {
  const sentrySetupDone = useRef(false);

  useEffect(() => {
    if (!dsn) return;

    try {
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn,
          environment: sentryEnvironment,
          ...(sentryRelease ? { release: sentryRelease } : {}),
          initialScope: (scope) => {
            scope.setTag("environment", sentryEnvironment);
            return scope;
          },
          beforeSend: withPatchedEnvironment,
          beforeSendTransaction: withPatchedEnvironment,
          tracesSampleRate: 0.2,
          replaysOnErrorSampleRate: 1.0,
          replaysSessionSampleRate: 0.05,
          ...(process.env.NODE_ENV === "development"
            ? { tunnel: "/api/sentry-tunnel" }
            : {}),
        });
      } else if (!sentrySetupDone.current) {
        Sentry.addEventProcessor((event) => {
          patchEventEnvironment(event);
          return event;
        });
      }
      sentrySetupDone.current = true;
      applyEnvironmentTags();
    } catch {
      return;
    }

    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const exposeConsoleApi =
      Boolean(Sentry.getClient()) &&
      (process.env.NODE_ENV === "development" ||
        host === "localhost" ||
        host === "127.0.0.1");

    if (exposeConsoleApi) {
      (
        window as Window & {
          __KAME_SENTRY_TEST__?: {
            captureException: typeof Sentry.captureException;
            captureMessage: typeof Sentry.captureMessage;
            flush: (timeout?: number) => Promise<boolean>;
          };
        }
      ).__KAME_SENTRY_TEST__ = {
        captureException: Sentry.captureException.bind(Sentry),
        captureMessage: Sentry.captureMessage.bind(Sentry),
        flush: (timeout = 2000) => Sentry.flush(timeout),
      };
    }
  }, []);

  return null;
}
