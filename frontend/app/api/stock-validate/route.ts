

export async function POST(req: Request) {
  // Contract: transparent proxy to Django and NEVER throw 500 due to parsing errors.

  // 1) Read body exactly as JSON (if invalid JSON, return controlled 400)
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return Response.json(
      {
        ok: false,
        warningsByVariantId: {},
        hintsByVariantId: {},
        error: "Invalid JSON body",
      },
      { status: 400 }
    );
  }

  // 2) Build target URL (must be consistent with backend)
  const base = (process.env.DJANGO_API_BASE || "").replace(/\/$/, "");
  const target = `${base}/api/stock-validate/`;

  if (!base) {
    return Response.json(
      {
        ok: false,
        warningsByVariantId: {},
        hintsByVariantId: {},
        error: "DJANGO_API_BASE is not configured",
      },
      { status: 500 }
    );
  }

  // 3) Forward cookies + CSRF if present
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  const csrf = req.headers.get("x-csrftoken") || req.headers.get("x-csrf-token");
  if (csrf) headers["X-CSRFToken"] = csrf;

  // 4) Call backend and ALWAYS return controlled JSON, even if backend returns HTML
  let backendRes: Response;
  try {
    backendRes = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      {
        ok: false,
        warningsByVariantId: {},
        hintsByVariantId: {},
        error: "Failed to reach backend",
      },
      { status: 502 }
    );
  }

  const status = backendRes.status;
  const contentType = backendRes.headers.get("content-type") || "";

  // Try JSON first, fallback to text
  try {
    if (contentType.includes("application/json")) {
      const json = await backendRes.json();
      return Response.json(json, { status });
    }

    // Not JSON: read text (HTML, etc.) and wrap
    const text = await backendRes.text();
    return Response.json(
      {
        ok: false,
        warningsByVariantId: {},
        hintsByVariantId: {},
        error: text ? `Backend returned non-JSON response (${status})` : `Backend error (${status})`,
      },
      { status }
    );
  } catch {
    // If parsing failed for any reason, still return controlled JSON
    return Response.json(
      {
        ok: false,
        warningsByVariantId: {},
        hintsByVariantId: {},
        error: `Backend response could not be parsed (${status})`,
      },
      { status }
    );
  }
}