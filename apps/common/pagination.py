"""Common pagination utilities.

This module provides a DRF pagination class that returns **relative** next/previous
links (path + query) instead of absolute URLs. This is useful when the backend is
behind a reverse proxy / tunnel and the external host can change.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from rest_framework.pagination import PageNumberPagination


class RelativePageNumberPagination(PageNumberPagination):
    """PageNumberPagination that returns relative `next`/`previous` links.

    DRF's default `get_next_link()` / `get_previous_link()` returns absolute URLs
    via `request.build_absolute_uri(...)`. When running behind proxies/tunnels,
    that host may be `127.0.0.1` (internal) instead of the public host.

    This class converts those absolute URLs to relative URLs: `/path?query`.
    """

    # Allow clients to request a specific page size via ?page_size=...
    # Useful for mobile and for debugging pagination.
    page_size_query_param = "page_size"
    max_page_size = 100

    def _to_relative(self, absolute_url: str | None) -> str | None:
        if not absolute_url:
            return None
        parts = urlsplit(absolute_url)
        # Keep only path + query; drop scheme/host/fragment.
        if parts.query:
            return f"{parts.path}?{parts.query}"
        return parts.path

    def get_next_link(self):  # type: ignore[override]
        return self._to_relative(super().get_next_link())

    def get_previous_link(self):  # type: ignore[override]
        return self._to_relative(super().get_previous_link())
