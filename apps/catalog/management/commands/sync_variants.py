

from django.core.management.base import BaseCommand

from apps.catalog.models import InventoryPool
from apps.catalog.services.variant_sync import sync_variants_for_pool


class Command(BaseCommand):
    help = "Sincroniza todas las variantes desde InventoryPool"

    def handle(self, *args, **kwargs):
        pools = InventoryPool.objects.all()

        for pool in pools:
            sync_variants_for_pool(pool.id)

        self.stdout.write(self.style.SUCCESS("Variants sincronizados"))