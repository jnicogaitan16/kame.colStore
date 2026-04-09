"""
URL conf for the custom admin API.

All paths are mounted under /api/ in config/urls.py.
"""
from django.urls import path

from . import (
    views_auth,
    views_dashboard,
    views_orders,
    views_inventory,
    views_customers,
    views_analytics,
    views_products,
    views_events,
    views_homepage,
)

app_name = "admin_api"

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────
    path("auth/login/",       views_auth.login_view,      name="auth-login"),
    path("auth/login",        views_auth.login_view,      name="auth-login-ns"),
    path("auth/verify-otp/",  views_auth.verify_otp_view, name="auth-verify-otp"),
    path("auth/verify-otp",   views_auth.verify_otp_view, name="auth-verify-otp-ns"),
    path("auth/logout/",      views_auth.logout_view,     name="auth-logout"),
    path("auth/logout",       views_auth.logout_view,     name="auth-logout-ns"),
    path("auth/me/",          views_auth.me_view,         name="auth-me"),
    path("auth/me",           views_auth.me_view,         name="auth-me-ns"),

    # ── Event ingestion (public) ──────────────────────────────────────────
    path("events/",  views_events.ingest_events, name="events-ingest"),
    path("events",   views_events.ingest_events, name="events-ingest-ns"),

    # ── Dashboard ─────────────────────────────────────────────────────────
    path("admin/dashboard/", views_dashboard.dashboard_view, name="admin-dashboard"),
    path("admin/dashboard",  views_dashboard.dashboard_view, name="admin-dashboard-ns"),

    # ── Orders ────────────────────────────────────────────────────────────
    path("admin/orders/",                             views_orders.orders_list,         name="admin-orders-list"),
    path("admin/orders",                              views_orders.orders_list,         name="admin-orders-list-ns"),
    # Fixed-segment paths MUST come before <str:reference> to avoid being swallowed
    path("admin/orders/pending-recovery/",            views_analytics.pending_recovery_list, name="admin-pending-recovery"),
    path("admin/orders/pending-recovery",             views_analytics.pending_recovery_list, name="admin-pending-recovery-ns"),
    path("admin/orders/<str:reference>/",             views_orders.order_detail,        name="admin-order-detail"),
    path("admin/orders/<str:reference>",              views_orders.order_detail,        name="admin-order-detail-ns"),
    path("admin/orders/<str:reference>/ship/",        views_orders.order_ship,          name="admin-order-ship"),
    path("admin/orders/<str:reference>/ship",         views_orders.order_ship,          name="admin-order-ship-ns"),
    path("admin/orders/<str:reference>/cancel/",      views_orders.order_cancel,        name="admin-order-cancel"),
    path("admin/orders/<str:reference>/cancel",       views_orders.order_cancel,        name="admin-order-cancel-ns"),
    path("admin/orders/<str:reference>/send-reminder/", views_orders.order_send_reminder, name="admin-order-reminder"),
    path("admin/orders/<str:reference>/send-reminder",  views_orders.order_send_reminder, name="admin-order-reminder-ns"),

    # ── Inventory ─────────────────────────────────────────────────────────
    path("admin/inventory/bulk/",        views_inventory.inventory_bulk_load, name="admin-inventory-bulk"),
    path("admin/inventory/bulk",         views_inventory.inventory_bulk_load, name="admin-inventory-bulk-ns"),
    path("admin/inventory/",              views_inventory.inventory_list,    name="admin-inventory-list"),
    path("admin/inventory",               views_inventory.inventory_list,    name="admin-inventory-list-ns"),
    path("admin/inventory/<int:pool_id>/", views_inventory.inventory_update,  name="admin-inventory-update"),
    path("admin/inventory/<int:pool_id>/history/", views_inventory.inventory_history, name="admin-inventory-history"),
    path("admin/inventory/<int:pool_id>/history",  views_inventory.inventory_history, name="admin-inventory-history-ns"),

    # ── Customers ─────────────────────────────────────────────────────────
    path("admin/customers/",                  views_customers.customers_list,   name="admin-customers-list"),
    path("admin/customers",                   views_customers.customers_list,   name="admin-customers-list-ns"),
    path("admin/customers/<int:customer_id>/delete/", views_customers.customer_delete, name="admin-customer-delete"),
    path("admin/customers/<int:customer_id>/delete",  views_customers.customer_delete, name="admin-customer-delete-ns"),
    path("admin/customers/<int:customer_id>/", views_customers.customer_detail,  name="admin-customer-detail"),
    path("admin/customers/<int:customer_id>",  views_customers.customer_detail,  name="admin-customer-detail-ns"),

    # ── Analytics ─────────────────────────────────────────────────────────
    path("admin/analytics/", views_analytics.analytics_view, name="admin-analytics"),
    path("admin/analytics",  views_analytics.analytics_view, name="admin-analytics-ns"),

    # ── Products ──────────────────────────────────────────────────────────
    path("admin/products/",                           views_products.products_list,      name="admin-products-list"),
    path("admin/products",                            views_products.products_list,      name="admin-products-list-ns"),
    path("admin/products/create/",                    views_products.products_create,    name="admin-products-create"),
    path("admin/products/create",                     views_products.products_create,    name="admin-products-create-ns"),
    path("admin/products/<int:product_id>/",          views_products.product_detail,     name="admin-product-detail"),
    path("admin/products/<int:product_id>/edit/",     views_products.product_update,     name="admin-product-update"),
    path("admin/products/<int:product_id>/edit",      views_products.product_update,     name="admin-product-update-ns"),
    path("admin/products/<int:product_id>/delete/",   views_products.product_delete,     name="admin-product-delete"),
    path("admin/products/<int:product_id>/variants/", views_products.product_add_variant, name="admin-product-variants"),
    path("admin/products/<int:product_id>/color-images/create/", views_products.product_color_image_create, name="admin-product-color-image-create"),
    path("admin/products/<int:product_id>/color-images/<int:image_id>/", views_products.product_color_image_update, name="admin-product-color-image-update"),
    path("admin/products/<int:product_id>/color-images/<int:image_id>/delete/", views_products.product_color_image_delete, name="admin-product-color-image-delete"),
    # Fixed-segment category paths must come before <int:category_id>
    path("admin/products/categories/create/",         views_products.category_create,    name="admin-category-create"),
    path("admin/products/categories/create",          views_products.category_create,    name="admin-category-create-ns"),
    path("admin/products/categories/",                views_products.categories_list,    name="admin-categories"),
    path("admin/products/categories",                 views_products.categories_list,    name="admin-categories-ns"),
    path("admin/products/categories/<int:category_id>/edit/", views_products.category_update, name="admin-category-update"),
    path("admin/products/categories/<int:category_id>/edit",  views_products.category_update, name="admin-category-update-ns"),
    path("admin/products/departments/create/",          views_products.department_create,  name="admin-department-create"),
    path("admin/products/departments/create",         views_products.department_create,  name="admin-department-create-ns"),
    path("admin/products/departments/<int:department_id>/delete/", views_products.department_delete, name="admin-department-delete"),
    path("admin/products/departments/<int:department_id>/delete",  views_products.department_delete, name="admin-department-delete-ns"),
    path("admin/products/departments/",               views_products.departments_list,   name="admin-departments"),
    path("admin/products/departments",                views_products.departments_list,   name="admin-departments-ns"),
    path("admin/products/departments/<int:department_id>/edit/", views_products.department_update, name="admin-department-update"),
    path("admin/products/departments/<int:department_id>/edit",  views_products.department_update, name="admin-department-update-ns"),

    # ── Homepage (banners / promos / sections) ────────────────────────────
    path("admin/homepage/banners/create/",             views_homepage.homepage_banner_create,    name="admin-homepage-banner-create"),
    path("admin/homepage/banners/create",              views_homepage.homepage_banner_create,    name="admin-homepage-banner-create-ns"),
    path("admin/homepage/banners/<int:banner_id>/delete/", views_homepage.homepage_banner_delete,  name="admin-homepage-banner-delete"),
    path("admin/homepage/banners/<int:banner_id>/delete",  views_homepage.homepage_banner_delete,  name="admin-homepage-banner-delete-ns"),
    path("admin/homepage/banners/",                    views_homepage.homepage_banners_list,   name="admin-homepage-banners"),
    path("admin/homepage/banners",                     views_homepage.homepage_banners_list,   name="admin-homepage-banners-ns"),
    path("admin/homepage/banners/<int:banner_id>/",    views_homepage.homepage_banner_update,  name="admin-homepage-banner-update"),
    path("admin/homepage/banners/<int:banner_id>",     views_homepage.homepage_banner_update,  name="admin-homepage-banner-update-ns"),
    path("admin/homepage/promos/create/",              views_homepage.homepage_promo_create,   name="admin-homepage-promo-create"),
    path("admin/homepage/promos/create",               views_homepage.homepage_promo_create,   name="admin-homepage-promo-create-ns"),
    path("admin/homepage/promos/<int:promo_id>/delete/", views_homepage.homepage_promo_delete,   name="admin-homepage-promo-delete"),
    path("admin/homepage/promos/<int:promo_id>/delete",  views_homepage.homepage_promo_delete,   name="admin-homepage-promo-delete-ns"),
    path("admin/homepage/promos/",                     views_homepage.homepage_promos_list,    name="admin-homepage-promos"),
    path("admin/homepage/promos",                      views_homepage.homepage_promos_list,    name="admin-homepage-promos-ns"),
    path("admin/homepage/promos/<int:promo_id>/",      views_homepage.homepage_promo_update,   name="admin-homepage-promo-update"),
    path("admin/homepage/promos/<int:promo_id>",       views_homepage.homepage_promo_update,   name="admin-homepage-promo-update-ns"),
    path("admin/homepage/sections/create/",            views_homepage.homepage_section_create, name="admin-homepage-section-create"),
    path("admin/homepage/sections/create",             views_homepage.homepage_section_create, name="admin-homepage-section-create-ns"),
    path("admin/homepage/sections/<int:section_id>/delete/", views_homepage.homepage_section_delete, name="admin-homepage-section-delete"),
    path("admin/homepage/sections/<int:section_id>/delete",  views_homepage.homepage_section_delete, name="admin-homepage-section-delete-ns"),
    path("admin/homepage/sections/",                   views_homepage.homepage_sections_list,  name="admin-homepage-sections"),
    path("admin/homepage/sections",                    views_homepage.homepage_sections_list,  name="admin-homepage-sections-ns"),
    path("admin/homepage/sections/<int:section_id>/",  views_homepage.homepage_section_update, name="admin-homepage-section-update"),
    path("admin/homepage/sections/<int:section_id>",   views_homepage.homepage_section_update, name="admin-homepage-section-update-ns"),
]
