/**
 * Proxy HTTP → Django bajo el prefijo /api/.
 * pathSegments: segmentos tras /api/ (ej. ["events"], ["auth", "me"]).
 */

export async function proxyDjangoApiRequest(
  req: Request,
  pathSegments: string[]
): Promise<Response> {
  const base = (process.env.DJANGO_API_BASE || "").replace(/\/$/, "");
  if (!base) {
    return Response.json(
      { error: "DJANGO_API_BASE is not configured" },
      { status: 500 }
    );
  }

  const path = pathSegments.filter(Boolean).join("/");
  const targetPath = path ? `${base}/api/${path}` : `${base}/api`;
  const target = new URL(`${targetPath}/`);
  target.search = new URL(req.url).search;

  const headers: Record<string, string> = {};

  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const accept = req.headers.get("accept");
  if (accept) headers["Accept"] = accept;

  const authorization = req.headers.get("authorization");
  if (authorization) headers["Authorization"] = authorization;

  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  const csrf =
    req.headers.get("x-csrftoken") || req.headers.get("x-csrf-token");
  if (csrf) headers["X-CSRFToken"] = csrf;

  let body: BodyInit | undefined = undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      body = buf;
    }
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(target.toString(), {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch (cause: unknown) {
    // 502 aquí = TCP falló (ECONNREFUSED, etc.), no “falta de variable”: DJANGO_API_BASE sí está definido.
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      const detail =
        cause instanceof Error ? cause.message : String(cause);
      console.warn(
        `[django-api-proxy] sin conexión a Django en ${base} → ${detail}. Levanta el backend o corrige DJANGO_API_BASE en frontend/.env.local.`
      );
    }
    return Response.json(
      isDev
        ? {
            error: "Failed to reach backend",
            hint:
              "Next.js ya lee DJANGO_API_BASE, pero no hay servidor respondiendo en esa URL. Ej.: en otra terminal `python manage.py runserver` (o el puerto que uses) y que coincida con frontend/.env.local.",
            django_base: base,
          }
        : { error: "Failed to reach backend" },
      { status: 502 }
    );
  }

  const outHeaders = new Headers(backendRes.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");
  outHeaders.delete("transfer-encoding");
  outHeaders.delete("connection");
  outHeaders.set("cache-control", "no-store");

  if (backendRes.status === 204 || backendRes.status === 205) {
    return new Response(null, { status: backendRes.status, headers: outHeaders });
  }

  const data = await backendRes.arrayBuffer();
  return new Response(data, {
    status: backendRes.status,
    headers: outHeaders,
  });
}

/** Si params del catch-all viene vacío (casos raros en dev), inferir desde la URL. */
export function resolveApiPathSegments(
  req: Request,
  params: { path?: string[] }
): string[] {
  if (params?.path?.length) return params.path;
  const pathname = new URL(req.url).pathname;
  const rest = pathname.replace(/^\/api\/?/i, "").replace(/\/+$/, "");
  if (!rest) return [];
  return rest.split("/").filter(Boolean);
}
