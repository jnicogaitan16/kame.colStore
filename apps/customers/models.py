from django.db import models
from django.core.validators import RegexValidator


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
        max_length=20,
        validators=[
            RegexValidator(
                regex=r"^\d{5,20}$",
                message="La cédula debe contener solo números (5 a 20 dígitos).",
            )
        ],
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        # Normalize email to avoid duplicates caused by case or spaces
        if self.email:
            self.email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        # Ensure normalization also happens if clean() is not explicitly called
        if self.email:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["document_type", "cedula"],
                name="uniq_customer_document_type_cedula",
            ),
        ]
        indexes = [
            models.Index(fields=["document_type", "cedula"], name="idx_customer_doc"),
        ]