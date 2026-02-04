from apps.orders.constants import (
    BOGOTA_CODE,
    FREE_SHIPPING_THRESHOLD,
    SHIPPING_BOGOTA,
    SHIPPING_NATIONAL,
)

def calculate_shipping_cost(*, subtotal: int, city_code: str) -> int:
    if subtotal >= FREE_SHIPPING_THRESHOLD:
        return 0
    if city_code == BOGOTA_CODE:
        return SHIPPING_BOGOTA
    return SHIPPING_NATIONAL