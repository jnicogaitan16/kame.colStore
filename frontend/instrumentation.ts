export async function register() {
  const runtime = process.env.NEXT_RUNTIME;
  if (runtime === "nodejs" || runtime === "edge") {
    await import("./sentry.runtime.config");
  }
}
