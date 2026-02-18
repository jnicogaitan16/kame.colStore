import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


def _env_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


class Command(BaseCommand):
    help = (
        "Idempotently ensure a Django superuser exists based on environment variables. "
        "Set DJANGO_CREATE_SUPERUSER=1 (or true/yes/on) plus DJANGO_SUPERUSER_USERNAME, "
        "DJANGO_SUPERUSER_EMAIL, DJANGO_SUPERUSER_PASSWORD."
    )

    def handle(self, *args, **options):
        if not _env_truthy(os.getenv("DJANGO_CREATE_SUPERUSER")):
            self.stdout.write("DJANGO_CREATE_SUPERUSER not set/truthy; skipping.")
            return

        username = (os.getenv("DJANGO_SUPERUSER_USERNAME") or "").strip()
        email = (os.getenv("DJANGO_SUPERUSER_EMAIL") or "").strip()
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD") or ""

        if not username or not email or not password:
            self.stderr.write(
                "Missing required env vars. Need DJANGO_SUPERUSER_USERNAME, "
                "DJANGO_SUPERUSER_EMAIL, DJANGO_SUPERUSER_PASSWORD."
            )
            return

        User = get_user_model()

        # Prefer username match; fallback to email match if username field differs in custom user models.
        user_qs = User._default_manager.filter(**{User.USERNAME_FIELD: username})
        if not user_qs.exists() and hasattr(User, "email"):
            user_qs = User._default_manager.filter(email=email)

        if user_qs.exists():
            self.stdout.write("Superuser already exists; nothing to do.")
            return

        self.stdout.write("Creating superuser...")

        create_kwargs = {User.USERNAME_FIELD: username}
        if hasattr(User, "email"):
            create_kwargs["email"] = email

        User._default_manager.create_superuser(password=password, **create_kwargs)
        self.stdout.write(self.style.SUCCESS("Superuser created successfully."))
