from datetime import datetime, timezone

import sentry_sdk
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Envía un error de prueba al Sentry del backend y hace flush del transporte. "
        "Falla si settings no tiene SENTRY_DSN_BACKEND (misma condición que sentry_sdk.init). "
        "Útil antes de deploy."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout",
            type=float,
            default=15.0,
            help="Segundos máximos de espera en flush (default: 15).",
        )

    def handle(self, *args, **options):
        dsn = getattr(settings, "SENTRY_DSN_BACKEND", "") or ""
        if not str(dsn).strip():
            raise CommandError(
                "SENTRY_DSN no está definido (settings.SENTRY_DSN_BACKEND vacío): "
                "no se ejecuta sentry_sdk.init. Definilo en .env (raíz) o en Render."
            )

        if sentry_sdk.get_client() is None:
            raise CommandError("Cliente Sentry no disponible tras cargar settings.")

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        message = f"Kame.col backend verify_sentry ({ts})"
        event_id = sentry_sdk.capture_exception(RuntimeError(message))

        self.stdout.write(f"Event id local: {event_id}")
        self.stdout.write(f"Mensaje: {message}")

        timeout = options["timeout"]
        sentry_sdk.flush(timeout=timeout)

        self.stdout.write(
            self.style.SUCCESS(
                f"flush(timeout={timeout}) ejecutado. "
                "Buscá este texto en Sentry (proyecto del DSN backend, últimas 24h)."
            )
        )
        self.stdout.write("Si no llega: SENTRY_DEBUG=1 python manage.py verify_sentry")
