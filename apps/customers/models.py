from django.db import models
from django.core.validators import RegexValidator

from apps.common.crypto import encrypt_value, decrypt_value, make_blind_index


class Customer(models.Model):
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True)
    email = models.EmailField(blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=30, blank=True)
    document_type = models.CharField(
        max_length=10,
        blank=True,
        default="CC",
        help_text="Tipo de documento principal del cliente (CC, NIT, ...).",
    )
    cedula = models.CharField(
        max_length=500,
        validators=[
            RegexValidator(
                regex=r"^\d{5,20}$",
                message="La cédula debe contener solo números (5 a 20 dígitos).",
            )
        ],
    )
    cedula_hash = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text="HMAC-SHA256 blind index for encrypted cedula lookups.",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        # Encrypt cedula and generate blind index
        if self.cedula and not self.cedula.startswith("gAAAAA"):
            self.cedula_hash = make_blind_index(self.cedula)
            self.cedula = encrypt_value(self.cedula)
        super().save(*args, **kwargs)

    @property
    def cedula_plain(self) -> str:
        """Decrypt and return the original cedula value."""
        return decrypt_value(self.cedula)

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["document_type", "cedula_hash"],
                name="uniq_customer_document_type_cedula_hash",
            ),
        ]
        indexes = [
            models.Index(fields=["document_type", "cedula_hash"], name="idx_customer_doc_hash"),
        ]