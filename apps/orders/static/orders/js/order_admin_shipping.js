

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
      // Trigger change so Django admin updates dirty-state correctly
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

  async function fetchQuote(cityCode, subtotal) {
    const params = new URLSearchParams({
      city_code: cityCode,
      subtotal: String(subtotal),
    });

    const res = await fetch(`/orders/api/shipping-quote/?${params.toString()}`, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!res.ok) {
      throw new Error(`Quote failed: ${res.status}`);
    }

    return await res.json();
  }

  // -----------------------------
  // Main
  // -----------------------------
  document.addEventListener("DOMContentLoaded", function () {
    const cityEl = qs("#id_city_code");
    const subtotalEl = qs("#id_subtotal") || qs("#id_sub_total") || qs("#id_amount");

    // shipping_cost could be editable OR rendered readonly depending on your admin config
    const shippingEl = qs("#id_shipping_cost") || qs("#shipping_cost") || qs(".field-shipping_cost .readonly");

    // total is often readonly in admin
    const totalEl = qs("#id_total") || qs("#total") || qs(".field-total .readonly");

    // If core fields are missing, do nothing (keeps admin safe)
    if (!cityEl || !subtotalEl || !shippingEl || !totalEl) return;

    const recalc = async function () {
      const cityCode = getValue(cityEl).trim();
      const subtotal = parseIntSafe(getValue(subtotalEl));

      if (!cityCode) {
        // No city selected: keep current values
        return;
      }

      try {
        const data = await fetchQuote(cityCode, subtotal);
        setValue(shippingEl, data.shipping_cost);
        setValue(totalEl, data.total);
      } catch (e) {
        // Fail silently to avoid breaking admin UX
        // (You can console.log for debugging)
        // console.error(e);
      }
    };

    const recalcDebounced = debounce(recalc, 200);

    cityEl.addEventListener("change", recalc);
    subtotalEl.addEventListener("input", recalcDebounced);

    // Initial calculation
    recalc();
  });
})();