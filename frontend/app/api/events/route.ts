// Ruta explícita: POST /api/events a veces no matcheaba el catch-all [...path] en dev (404 en Next).
import { proxyDjangoApiRequest } from "@/lib/django-api-proxy";

export async function GET(req: Request) {
  return proxyDjangoApiRequest(req, ["events"]);
}

export async function POST(req: Request) {
  return proxyDjangoApiRequest(req, ["events"]);
}

export async function PUT(req: Request) {
  return proxyDjangoApiRequest(req, ["events"]);
}

export async function PATCH(req: Request) {
  return proxyDjangoApiRequest(req, ["events"]);
}

export async function DELETE(req: Request) {
  return proxyDjangoApiRequest(req, ["events"]);
}

export async function HEAD(req: Request) {
  return proxyDjangoApiRequest(req, ["events"]);
}

export async function OPTIONS(req: Request) {
  return proxyDjangoApiRequest(req, ["events"]);
}
