// frontend/app/api/[...path]/route.ts
// Catch-all API proxy for /api/*
// Forwards any request to `${DJANGO_API_BASE}/api/*`.
// IMPORTANT: Always add trailing slash to match DRF endpoints (you have APPEND_SLASH=False).

const buildTargetUrl = (req: Request, params: { path?: string[] }) => {
  const base = (process.env.DJANGO_API_BASE || "").replace(/\/$/, "");
  if (!base) throw new Error("DJANGO_API_BASE is not configured");

  const pathSegments = params.path || [];
  const path = pathSegments.join("/");

  const incoming = new URL(req.url);

  // Django expects trailing slash for most DRF endpoints.
  // Avoid double slashes when path is empty.
  const target = new URL(path ? `${base}/api/${path}/` : `${base}/api/`);

  // Preserve querystring exactly
  target.search = incoming.search;

  return target.toString();
};

const forwardRequest = async (
  req: Request,
  context: { params: { path?: string[] } }
) => {
  let target: string;

  try {
    target = buildTargetUrl(req, context.params);
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Invalid configuration" },
      { status: 500 }
    );
  }

  const headers: Record<string, string> = {};

  // Forward content-type if present
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  // Minimal useful headers
  const accept = req.headers.get("accept");
  if (accept) headers["Accept"] = accept;

  const authorization = req.headers.get("authorization");
  if (authorization) headers["Authorization"] = authorization;

  // Forward cookies
  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  // Forward CSRF if present
  const csrf =
    req.headers.get("x-csrftoken") || req.headers.get("x-csrf-token");
  if (csrf) headers["X-CSRFToken"] = csrf;

  // Only attach body for non-GET/HEAD
  let body: BodyInit | undefined = undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await req.text();
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Failed to reach backend" }, { status: 502 });
  }

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: backendRes.headers,
  });
};

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