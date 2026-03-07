from django.apps import AppConfig


class CatalogConfig(AppConfig):
    name = "apps.catalog"

    def ready(self):
        import apps.catalog.signals
