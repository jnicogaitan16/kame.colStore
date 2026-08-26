// frontend/app/api/[...path]/route.ts
// Catch-all API proxy para /api/* (excepto rutas más específicas como /api/events).
// Reenvía a `${DJANGO_API_BASE}/api/*`.

import {
  proxyDjangoApiRequest,
  resolveApiPathSegments,
} from "@/lib/django-api-proxy";

type RouteContext = { params: { path?: string[] } };

async function forwardRequest(req: Request, context: RouteContext) {
  const segments = resolveApiPathSegments(req, context.params);
  return proxyDjangoApiRequest(req, segments);
}

export async function GET(req: Request, context: RouteContext) {
  return forwardRequest(req, context);
}
export async function POST(req: Request, context: RouteContext) {
  return forwardRequest(req, context);
}
export async function PUT(req: Request, context: RouteContext) {
  return forwardRequest(req, context);
}
export async function PATCH(req: Request, context: RouteContext) {
  return forwardRequest(req, context);
}
export async function DELETE(req: Request, context: RouteContext) {
  return forwardRequest(req, context);
}
export async function HEAD(req: Request, context: RouteContext) {
  return forwardRequest(req, context);
}
export async function OPTIONS(req: Request, context: RouteContext) {
  return forwardRequest(req, context);
}
