(function () {
  "use strict";

  // -----------------------------
  // Helpers
  // -----------------------------
  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function qs(sel) {
    return document.querySelector(sel);
  }

  function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  function getValue(el) {
    if (!el) return "";
    // Readonly fields in Django admin may be rendered as <div class="readonly">...</div>
    if ("value" in el) return String(el.value || "");
    return String(el.textContent || "").trim();
  }

  function setValue(el, val) {
    if (!el) return;
    const v = val == null ? "" : String(val);
    if ("value" in el) {
      el.value = v;
      // Trigger input + change so Django admin widgets update immediately
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    el.textContent = v;
  }

  function parseIntSafe(v) {
    // Accept numbers like "150000", "150.000", "$150,000"
    const cleaned = String(v || "").replace(/[^0-9-]/g, "");
    if (!cleaned) return 0;
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function parseFloatSafe(v) {
    // Accept numbers like "150000", "150.000", "150,000.50", "$150.000,50" (best-effort)
    const s = String(v || "").trim();
    if (!s) return 0;

    // Remove currency symbols/spaces
    let cleaned = s.replace(/[^0-9,.-]/g, "");

    // If both comma and dot exist, assume dot is thousands and comma is decimal OR vice-versa.
    // Best-effort: keep the last separator as decimal.
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");

    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        // 150.000,50 -> remove dots, replace comma with dot
        cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
      } else {
        // 150,000.50 -> remove commas
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (lastComma !== -1 && lastDot === -1) {
      // 150000,50 -> comma decimal
      cleaned = cleaned.replace(/,/g, ".");
    }

    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  function escapeId(id) {
    // CSS.escape is supported in modern browsers; keep fallback for safety.
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(id);
    return String(id).replace(/([ #;?%&,.+*~\':!^$\[\]()=>|\/\\@])/g, "\\$1");
  }

  // -----------------------------
  // API
  // -----------------------------
  async function fetchQuote(cityCode, subtotal) {
    const csrftoken = getCookie("csrftoken");

    // Keep POST (works with CSRF in admin) but also include query params for compatibility.
    const url = `/orders/api/shipping-quote/?city_code=${encodeURIComponent(
      cityCode
    )}&subtotal=${encodeURIComponent(String(subtotal))}`;

    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken || "",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        city_code: cityCode,
        subtotal: subtotal,
      }),
    });

    if (!res.ok) {
      throw new Error(`Quote failed: ${res.status}`);
    }

    return await res.json();
  }

  async function fetchVariantPrice(variantId) {
    const url = `/orders/api/variant-price/?variant_id=${encodeURIComponent(String(variantId || ""))}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!res.ok) {
      throw new Error(`Variant price failed: ${res.status}`);
    }

    return await res.json();
  }

  async function fetchCustomerSnapshot(customerId) {
    const url = `/orders/api/customer-snapshot/?customer_id=${encodeURIComponent(String(customerId || ""))}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!res.ok) {
      throw new Error(`Customer snapshot failed: ${res.status}`);
    }

    return await res.json();
  }

  // -----------------------------
  // Inline subtotal calculation
  // -----------------------------
  const RE_QTY = /^id_.+-quantity$/;
  const RE_PRICE = /^id_.+-unit_price$/;
  const RE_DELETE = /^id_.+-DELETE$/;
  const RE_PV = /^id_.+-(product_variant|product_variant_id)$/;

  function getInlineRows() {
    // Generic: derive rows from any quantity inputs matching the expected Django inline naming.
    return qsa('input[id^="id_"]').filter((el) => RE_QTY.test(el.id)).map((qtyEl) => {
      const id = qtyEl.id;
      const base = id.replace(/-quantity$/, "");

      const priceEl = document.getElementById(`${base}-unit_price`);
      const delEl = document.getElementById(`${base}-DELETE`);

      // product_variant could be select or hidden input (depending on autocomplete widgets)
      const pvEl =
        document.getElementById(`${base}-product_variant`) ||
        document.getElementById(`${base}-product_variant_id`) ||
        qs(`#${escapeId(base)}-product_variant`) ||
        qs(`#${escapeId(base)}-product_variant_id`);

      return { base, qtyEl, priceEl, delEl, pvEl };
    });
  }

  function computeSubtotalFromInlines() {
    const rows = getInlineRows();
    let subtotal = 0;

    for (const row of rows) {
      const isDeleted = row.delEl && row.delEl.checked;
      if (isDeleted) continue;

      const qty = parseIntSafe(getValue(row.qtyEl));

      // unit_price fallback: allow dataset.unitPrice when the input looks empty
      let unit = parseFloatSafe(getValue(row.priceEl));
      if ((!unit || unit <= 0) && row.priceEl && row.priceEl.dataset && row.priceEl.dataset.unitPrice) {
        unit = parseFloatSafe(row.priceEl.dataset.unitPrice);
      }

      if (!qty || qty <= 0) continue;
      if (!unit || unit <= 0) continue;

      subtotal += qty * unit;
    }

    // COP: round to integer in case unit_price has decimals
    return Math.round(subtotal);
  }

  // -----------------------------
  // Main
  // -----------------------------
  document.addEventListener("DOMContentLoaded", function () {
    // 1) Detect main form inputs
    const cityEl = qs("#id_city_code");
    const subtotalEl = qs("#id_subtotal") || qs("#id_sub_total") || qs("#id_amount");

    // shipping_cost could be editable OR rendered readonly depending on your admin config
    const shippingEl =
      qs("#id_shipping_cost") ||
      qs("#shipping_cost") ||
      qs(".field-shipping_cost .readonly");

    // total is often readonly in admin
    const totalEl = qs("#id_total") || qs("#total") || qs(".field-total .readonly");

    // Customer and autofill targets
    const customerEl = qs("#id_customer");
    const fullNameEl = qs("#id_full_name");
    const phoneEl = qs("#id_phone");
    const emailEl = qs("#id_email");
    const cedulaEl = qs("#id_cedula");

    // If core shipping fields are missing, keep admin safe (but still allow customer autofill)
    const hasShippingCore = !!(cityEl && subtotalEl && shippingEl && totalEl);

    // Avoid loops when we update subtotal programmatically
    let isProgrammaticSubtotalUpdate = false;

    const recalcQuote = async function () {
      if (!hasShippingCore) return;

      const cityCode = getValue(cityEl).trim();
      const subtotal = parseIntSafe(getValue(subtotalEl));

      if (!cityCode) return;

      try {
        const data = await fetchQuote(cityCode, subtotal);
        setValue(shippingEl, data.shipping_cost);
        setValue(totalEl, data.total);
      } catch (e) {
        console.error("Error al calcular envío:", e);

        // Subtle visual feedback
        if (shippingEl && "value" in shippingEl) {
          const currentShipping = getValue(shippingEl);
          if (!currentShipping || currentShipping === "0") {
            shippingEl.style.borderColor = "#dc3545";
            setTimeout(() => {
              if (shippingEl) shippingEl.style.borderColor = "";
            }, 2000);
          }
        }
      }
    };

    const recalcSubtotalAndQuote = async function () {
      if (!hasShippingCore) return;

      const computed = computeSubtotalFromInlines();

      isProgrammaticSubtotalUpdate = true;
      setValue(subtotalEl, computed);
      window.setTimeout(() => {
        isProgrammaticSubtotalUpdate = false;
      }, 0);

      await recalcQuote();
    };

    // Debounce for inline edits
    const recalcSubtotalAndQuoteDebounced = debounce(recalcSubtotalAndQuote, 200);
    const recalcQuoteDebounced = debounce(recalcQuote, 200);

    async function handleProductVariantChange(pvEl) {
      if (!pvEl) return;

      const variantId = getValue(pvEl).trim();
      if (!variantId) {
        // If variant cleared, we still recalc subtotal (row might become invalid)
        recalcSubtotalAndQuoteDebounced();
        return;
      }

      // Derive base from pv id
      const pvId = pvEl.id || "";
      if (!pvId) {
        recalcSubtotalAndQuoteDebounced();
        return;
      }

      const base = pvId.replace(/-(product_variant|product_variant_id)$/, "");
      const priceEl = document.getElementById(`${base}-unit_price`) || qs(`#${escapeId(base)}-unit_price`);

      try {
        const data = await fetchVariantPrice(variantId);

        // Accept either {unit_price: ...} or {price: ...}
        const unitPrice =
          data && data.unit_price != null ? data.unit_price : data && data.price != null ? data.price : "";

        if (priceEl) {
          // Set immediately
          setValue(priceEl, unitPrice);
          // And store fallback value for cases where input looks empty (admin widgets)
          priceEl.dataset.unitPrice = String(unitPrice == null ? "" : unitPrice);
        }
      } catch (e) {
        console.error("Error al obtener unit_price del variant:", e);
      }

      // After updating price, recalc subtotal + quote
      recalcSubtotalAndQuoteDebounced();
    }

    async function handleCustomerChange() {
      if (!customerEl) return;

      const customerId = getValue(customerEl).trim();

      // Prevent parallel calls when multiple widget events fire
      if (handleCustomerChange._busy) return;

      if (!customerId) return;

      try {
        handleCustomerChange._busy = true;
        const data = await fetchCustomerSnapshot(customerId);

        // Best-effort mapping. Backend can return any of these keys.
        const fullName = data.full_name ?? data.name ?? "";
        const phone = data.phone ?? "";
        const email = data.email ?? "";
        const cedula = data.cedula ?? data.document ?? data.cc ?? "";

        if (fullNameEl) setValue(fullNameEl, fullName);
        if (phoneEl) setValue(phoneEl, phone);
        if (emailEl) setValue(emailEl, email);
        if (cedulaEl) setValue(cedulaEl, cedula);
      } catch (e) {
        console.error("Error al autofill de customer:", e);
      } finally {
        handleCustomerChange._busy = false;
      }
    }

    // -----------------------------
    // Events
    // -----------------------------

    // change city -> quote
    if (cityEl && hasShippingCore) {
      cityEl.addEventListener("change", recalcQuote);
    }

    // input subtotal (manual edit) -> quote (but ignore programmatic updates)
    if (subtotalEl && hasShippingCore) {
      subtotalEl.addEventListener("input", function () {
        if (isProgrammaticSubtotalUpdate) return;
        recalcQuoteDebounced();
      });
    }

    // Autofill customer (works for regular <select>, raw_id_fields, and select2/autocomplete widgets)
    if (customerEl) {
      // 1) Normal DOM events
      customerEl.addEventListener("change", handleCustomerChange);
      customerEl.addEventListener("input", debounce(handleCustomerChange, 150));

      // 2) Django admin Select2/autocomplete (jQuery-based)
      // Django admin uses Select2; the visible widget is a different DOM node.
      // We listen to the select2 container and to the jQuery events if jQuery exists.
      try {
        const $ = window.django && window.django.jQuery ? window.django.jQuery : window.jQuery;
        if ($ && $(customerEl).length) {
          $(customerEl).on("change", handleCustomerChange);
          $(customerEl).on("select2:select select2:clear", handleCustomerChange);
        }
      } catch (e) {
        // ignore
      }

      // 3) Capture any bubbled change at document level (some widgets set value programmatically)
      document.addEventListener(
        "change",
        function (e) {
          const t = e.target;
          if (!t) return;
          if (t === customerEl || t.id === "id_customer") {
            handleCustomerChange();
          }
        },
        true
      );

      // 4) Last-resort fallback: poll for value changes
      (function wireCustomerPollingFallback() {
        let lastVal = getValue(customerEl).trim();
        window.setInterval(function () {
          const nowVal = getValue(customerEl).trim();
          if (nowVal !== lastVal) {
            lastVal = nowVal;
            handleCustomerChange();
          }
        }, 300);
      })();

      // 5) If the form loads with a preselected customer (change page), fill immediately
      if (getValue(customerEl).trim()) {
        handleCustomerChange();
      }
    }

    // Inline events (generic, regex-based)
    function wireInlineEvents() {
      if (wireInlineEvents._wired) return;
      wireInlineEvents._wired = true;

      const inlineGroup = qs("#items-group") || qs("#orderitem_set-group") || qs(".inline-group") || document;

      inlineGroup.addEventListener("change", function (e) {
        const t = e.target;
        if (!t) return;
        const id = t.id || "";

        if (RE_PV.test(id)) {
          // PV change should update unit_price immediately
          handleProductVariantChange(t);
          return;
        }

        if (RE_QTY.test(id) || RE_PRICE.test(id) || RE_DELETE.test(id)) {
          recalcSubtotalAndQuoteDebounced();
        }
      });

      inlineGroup.addEventListener("input", function (e) {
        const t = e.target;
        if (!t) return;
        const id = t.id || "";

        if (RE_QTY.test(id) || RE_PRICE.test(id)) {
          recalcSubtotalAndQuoteDebounced();
        }
      });

      // Django admin formset event (available in many versions)
      document.addEventListener("formset:added", function () {
        recalcSubtotalAndQuoteDebounced();
      });
    }

    wireInlineEvents();

    // -----------------------------
    // Initial calculation
    // -----------------------------
    if (hasShippingCore) {
      const hasInlineQty = qsa('input[id^="id_"]').some((el) => RE_QTY.test(el.id));
      if (hasInlineQty) {
        recalcSubtotalAndQuote();
      } else {
        recalcQuote();
      }
    }
  });
})();