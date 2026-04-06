from django.conf import settings
from django.http import HttpResponseForbidden


class AdminIPRestrictionMiddleware:
    """Block access to /admin/ for IPs not in ADMIN_ALLOWED_IPS.

    If ADMIN_ALLOWED_IPS is empty (env var not set), the restriction is
    disabled — safe default for local dev without the variable configured.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/admin/") and settings.ADMIN_ALLOWED_IPS:
            client_ip = self._get_client_ip(request)
            if client_ip not in settings.ADMIN_ALLOWED_IPS:
                return HttpResponseForbidden("403 Forbidden")
        return self.get_response(request)

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            # Leftmost IP is the original client when behind a trusted proxy.
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
