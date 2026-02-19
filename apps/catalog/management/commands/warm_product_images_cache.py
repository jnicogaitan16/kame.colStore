from __future__ import annotations

import time

from django.core.management.base import BaseCommand


def _generate_spec(spec) -> str:
    """Generate an ImageKit spec in a version-compatible way and return its URL.

    Avoids ImageCacheFile because some imagekit versions don't support
    ImageCacheFile.get_hash().
    """
    # Preferred: explicit generation method on the spec
    gen = getattr(spec, "generate", None)
    if callable(gen):
        gen()
        return getattr(spec, "url", "") or ""

    # Fallback: some versions expose a cachefile object
    cachefile = getattr(spec, "cachefile", None)
    if cachefile is not None:
        cf_gen = getattr(cachefile, "generate", None)
        if callable(cf_gen):
            cf_gen()
            return getattr(cachefile, "url", "") or ""

    # Last resort: accessing spec.url may trigger generation
    return getattr(spec, "url", "") or ""


class Command(BaseCommand):
    help = (
        "Warm ImageKit cachefiles for existing product images (thumb/detail). "
        "Generates CACHE/images/... webp files in the configured storage (e.g., R2)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Optional max number of images to process (0 = no limit).",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=0.0,
            help="Optional sleep seconds between each image to reduce storage pressure.",
        )
        parser.add_argument(
            "--include-large",
            action="store_true",
            help="Also generate image_large (default: only thumb+medium).",
        )
        parser.add_argument(
            "--delete-missing",
            action="store_true",
            help="Delete ProductImage rows whose source file is missing in storage (DANGEROUS).",
        )
        parser.add_argument(
            "--dry-run-missing",
            action="store_true",
            default=True,
            help="When used with --delete-missing, print what would be deleted without deleting (default: True).",
        )

    def handle(self, *args, **options):
        # Import here to avoid app loading issues
        from apps.catalog.models import ProductImage

        include_large: bool = bool(options.get("include_large"))
        limit: int = int(options.get("limit") or 0)
        sleep_s: float = float(options.get("sleep") or 0.0)
        delete_missing: bool = bool(options.get("delete_missing"))
        dry_run_missing: bool = bool(options.get("dry_run_missing"))

        # Choose specs to warm
        spec_attrs = ["image_thumb", "image_medium"]
        if include_large:
            spec_attrs.append("image_large")

        qs = ProductImage.objects.only("id", "image").order_by("id")

        total = 0
        gen_ok = 0
        gen_fail = 0
        missing_source = 0
        spec_ok = 0
        spec_fail = 0
        missing_deleted = 0

        started = time.time()

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"Warming ImageKit cachefiles for ProductImage: specs={spec_attrs}"
            )
        )

        for img in qs.iterator(chunk_size=200):
            if limit and total >= limit:
                break
            total += 1

            if not getattr(img, "image", None):
                gen_fail += 1
                self.stdout.write(self.style.WARNING(f"[{img.id}] skipped: no image"))
                continue

            # Fast pre-check: DB may reference files that no longer exist in storage.
            try:
                src_name = getattr(img.image, "name", "")
                storage = getattr(img.image, "storage", None)
                if not src_name or storage is None or not storage.exists(src_name):
                    missing_source += 1
                    gen_fail += 1
                    spec_fail += len(spec_attrs)
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{img.id}] missing source file in storage: {src_name or '(empty)'}"
                        )
                    )

                    if delete_missing:
                        if dry_run_missing:
                            self.stdout.write(
                                self.style.NOTICE(
                                    f"[{img.id}] DRY-RUN delete ProductImage (missing source): {src_name or '(empty)'}"
                                )
                            )
                        else:
                            try:
                                img.delete()
                                missing_deleted += 1
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f"[{img.id}] deleted ProductImage (missing source)"
                                    )
                                )
                            except Exception as e:
                                self.stdout.write(
                                    self.style.WARNING(
                                        f"[{img.id}] delete failed (missing source): {e}"
                                    )
                                )

                    continue
            except Exception:
                # If storage check itself fails, fall back to generation attempt.
                pass

            ok_for_this_image = True

            for attr in spec_attrs:
                spec = getattr(img, attr, None)
                if not spec:
                    # Spec not defined on model; treat as failure for that spec
                    spec_fail += 1
                    ok_for_this_image = False
                    self.stdout.write(
                        self.style.WARNING(f"[{img.id}] missing spec: {attr}")
                    )
                    continue

                try:
                    _ = _generate_spec(spec)
                    spec_ok += 1
                except Exception as e:
                    spec_fail += 1
                    ok_for_this_image = False
                    self.stdout.write(
                        self.style.WARNING(f"[{img.id}] {attr} failed: {e}")
                    )

            if ok_for_this_image:
                gen_ok += 1
            else:
                gen_fail += 1

            if sleep_s:
                time.sleep(sleep_s)

            # Lightweight progress every 50
            if total % 50 == 0:
                elapsed = time.time() - started
                self.stdout.write(
                    f"Processed {total} images | ok={gen_ok} fail={gen_fail} missing_source={missing_source} missing_deleted={missing_deleted} | "
                    f"spec_ok={spec_ok} spec_fail={spec_fail} | {elapsed:.1f}s"
                )

        elapsed = time.time() - started

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Warm cache completed"))
        self.stdout.write(
            f"Images processed: {total} | ok={gen_ok} fail={gen_fail} missing_source={missing_source} missing_deleted={missing_deleted} | "
            f"spec_ok={spec_ok} spec_fail={spec_fail} | elapsed={elapsed:.1f}s"
        )

        # Optional: also warm variant images if the project defines such a model
        try:
            from apps.catalog.models import ProductVariantImage  # type: ignore

            self.stdout.write("")
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"Warming ImageKit cachefiles for ProductVariantImage: specs={spec_attrs}"
                )
            )

            total_v = 0
            gen_ok_v = 0
            gen_fail_v = 0
            spec_ok_v = 0
            spec_fail_v = 0
            started_v = time.time()

            qs_v = (
                ProductVariantImage.objects.select_related("variant")
                .only("id", "image")
                .order_by("id")
            )

            for imgv in qs_v.iterator(chunk_size=200):
                if limit and total_v >= limit:
                    break
                total_v += 1

                if not getattr(imgv, "image", None):
                    gen_fail_v += 1
                    continue

                ok_this = True
                for attr in spec_attrs:
                    spec = getattr(imgv, attr, None)
                    if not spec:
                        spec_fail_v += 1
                        ok_this = False
                        continue
                    try:
                        _ = _generate_spec(spec)
                        spec_ok_v += 1
                    except Exception:
                        spec_fail_v += 1
                        ok_this = False

                if ok_this:
                    gen_ok_v += 1
                else:
                    gen_fail_v += 1

                if sleep_s:
                    time.sleep(sleep_s)

                if total_v % 50 == 0:
                    elapsed_v = time.time() - started_v
                    self.stdout.write(
                        f"Processed {total_v} variant images | ok={gen_ok_v} fail={gen_fail_v} | "
                        f"spec_ok={spec_ok_v} spec_fail={spec_fail_v} | {elapsed_v:.1f}s"
                    )

            elapsed_v = time.time() - started_v
            self.stdout.write(self.style.SUCCESS("Warm cache (variant images) completed"))
            self.stdout.write(
                f"Variant images processed: {total_v} | ok={gen_ok_v} fail={gen_fail_v} | "
                f"spec_ok={spec_ok_v} spec_fail={spec_fail_v} | elapsed={elapsed_v:.1f}s"
            )

        except Exception:
            # No variant image model; nothing to do.
            return