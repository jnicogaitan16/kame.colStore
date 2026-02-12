from django.db import models
from django.core.validators import RegexValidator


class Customer(models.Model):
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True)
    email = models.EmailField(blank=True, null=True)
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

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(cedula=""),
                name="customer_cedula_not_empty",
            ),
            models.UniqueConstraint(
                fields=["document_type", "cedula"],
                name="uniq_customer_doc",
            ),
        ]