from django.apps import AppConfig


class CatalogConfig(AppConfig):
    name = 'apps.catalog'

    def ready(self):
        # Ensure signals are registered on app startup
        import apps.catalog.signals  # noqa
