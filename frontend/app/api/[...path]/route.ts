// frontend/app/api/[...path]/route.ts
// Catch-all API proxy para /api/* (excepto rutas más específicas como /api/events).
// Reenvía a `${DJANGO_API_BASE}/api/*`.

import {
  proxyDjangoApiRequest,
  resolveApiPathSegments,
} from "@/lib/django-api-proxy";

async function forwardRequest(
  req: Request,
  context: { params: { path?: string[] } }
) {
  const segments = resolveApiPathSegments(req, context.params);
  return proxyDjangoApiRequest(req, segments);
}

export async function GET(req: Request, context: any) {
  return forwardRequest(req, context);
}
export async function POST(req: Request, context: any) {
  return forwardRequest(req, context);
}
export async function PUT(req: Request, context: any) {
  return forwardRequest(req, context);
}
export async function PATCH(req: Request, context: any) {
  return forwardRequest(req, context);
}
export async function DELETE(req: Request, context: any) {
  return forwardRequest(req, context);
}
export async function HEAD(req: Request, context: any) {
  return forwardRequest(req, context);
}
export async function OPTIONS(req: Request, context: any) {
  return forwardRequest(req, context);
}
