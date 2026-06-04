"""Processors ImageKit para derivados aptos en correo (JPEG, fondo blanco)."""

from __future__ import annotations

from imagekit.processors import ResizeToFit


class FlattenWhiteBackground:
    """Convierte RGBA/LA/P a RGB con matte blanco (Gmail no compone alpha bien)."""

    def process(self, img):
        from PIL import Image as PILImage

        if img.mode in ("RGBA", "LA", "P"):
            if img.mode == "P":
                img = img.convert("RGBA")
            background = PILImage.new("RGB", img.size, (255, 255, 255))
            mask = img.split()[-1] if img.mode in ("RGBA", "LA") else None
            background.paste(img, mask=mask)
            return background
        if img.mode != "RGB":
            return img.convert("RGB")
        return img


EMAIL_IMAGE_PROCESSORS = [
    FlattenWhiteBackground(),
    ResizeToFit(300, 300),
]
