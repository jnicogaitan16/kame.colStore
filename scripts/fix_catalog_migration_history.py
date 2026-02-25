from django.db import connection
from django.utils import timezone

APP = "catalog"
MIG = "0003b_backfill_category_department"

with connection.cursor() as c:
    c.execute(
        """
        SELECT 1
        FROM django_migrations
        WHERE app=%s AND name=%s
        """,
        [APP, MIG],
    )
    exists = c.fetchone() is not None

    if not exists:
        c.execute(
            """
            INSERT INTO django_migrations (app, name, applied)
            VALUES (%s, %s, %s)
            """,
            [APP, MIG, timezone.now()],
        )
        print(f"✅ Insertado {APP}.{MIG} en django_migrations")
    else:
        print(f"ℹ️ Ya existía {APP}.{MIG} en django_migrations")
