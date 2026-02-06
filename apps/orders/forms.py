from django import forms
from apps.orders.constants import CITY_CHOICES

class CheckoutForm(forms.Form):
    # Cliente
    full_name = forms.CharField(label="Nombre completo", max_length=150)
    cedula = forms.CharField(label="Cédula", max_length=20)
    phone = forms.CharField(label="Teléfono/WhatsApp", max_length=30)
    email = forms.EmailField(label="Email", required=False)

    # Ciudad NO libre
    city_code = forms.ChoiceField(
        label="City",
        choices=[("", "---------")] + CITY_CHOICES
    )

    address = forms.CharField(label="Dirección", max_length=255)
    notes = forms.CharField(label="Indicaciones", required=False, widget=forms.Textarea)

    # Pago fijo (oculto)
    payment_method = forms.CharField(
        initial="transferencia",
        required=False,
        widget=forms.HiddenInput
    )