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
  // Django admin Select2/autocomplete can suffix ids like -product_variant_0
  const RE_PV = /^id_.+-(product_variant|product_variant_id)(?:_\d+)?$/;

  function getInlineRows() {
    // Generic: derive rows from any quantity inputs matching the expected Django inline naming.
    return qsa('input[id^="id_"]').filter((el) => RE_QTY.test(el.id)).map((qtyEl) => {
      const id = qtyEl.id;
      const base = id.replace(/-quantity$/, "");

      const priceEl = document.getElementById(`${base}-unit_price`);
      const delEl = document.getElementById(`${base}-DELETE`);

      // product_variant could be select or hidden input (depending on autocomplete widgets)
      // In some admin/select2 setups Django appends _0 to the id.
      const pvEl =
        document.getElementById(`${base}-product_variant`) ||
        document.getElementById(`${base}-product_variant_0`) ||
        document.getElementById(`${base}-product_variant_id`) ||
        document.getElementById(`${base}-product_variant_id_0`) ||
        qs(`#${escapeId(base)}-product_variant`) ||
        qs(`#${escapeId(base)}-product_variant_0`) ||
        qs(`#${escapeId(base)}-product_variant_id`) ||
        qs(`#${escapeId(base)}-product_variant_id_0`);

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
      qs(".field-shipping_cost .readonly") ||
      qs(".form-row.field-shipping_cost .readonly") ||
      qs(".form-row.field-shipping_cost p") ||
      qs(".field-shipping_cost p");

    // total is often readonly in admin (can be <div class="readonly"> or <p class="readonly">)
    const totalEl =
      qs("#id_total") ||
      qs("#total") ||
      qs(".field-total .readonly") ||
      qs(".form-row.field-total .readonly") ||
      qs(".form-row.field-total p") ||
      qs(".field-total p");

    // Customer and autofill targets
    const customerEl = qs("#id_customer");
    const fullNameEl = qs("#id_full_name");
    const phoneEl = qs("#id_phone");
    const emailEl = qs("#id_email");
    const cedulaEl = qs("#id_cedula");

    // Core fields required to keep totals consistent locally.
    const hasTotalsCore = !!(subtotalEl && totalEl);
    // Fields required to call the shipping quote endpoint.
    const hasQuoteCore = !!(cityEl && subtotalEl && shippingEl);

    // Avoid loops when we update subtotal programmatically
    let isProgrammaticSubtotalUpdate = false;

    // -----------------------------
    // Total calculation (local)
    // -----------------------------
    function updateTotalFromFields() {
      // total = subtotal + shipping_cost (treat blanks as 0)
      const subtotal = parseIntSafe(getValue(subtotalEl));
      const shipping = shippingEl ? parseIntSafe(getValue(shippingEl)) : 0;
      const total = subtotal + shipping;
      setValue(totalEl, total);
    }

    const recalcQuote = async function () {
      if (!hasTotalsCore) return;

      const subtotal = parseIntSafe(getValue(subtotalEl));

      // If we don't have quote fields (or city not selected), still keep total consistent locally.
      if (!hasQuoteCore) {
        updateTotalFromFields();
        return;
      }

      const cityCode = getValue(cityEl).trim();
      if (!cityCode) {
        updateTotalFromFields();
        return;
      }

      try {
        const data = await fetchQuote(cityCode, subtotal);
        setValue(shippingEl, data.shipping_cost);

        // Prefer backend total when provided, but ensure total is always consistent.
        if (data && data.total != null) {
          setValue(totalEl, data.total);
        } else {
          updateTotalFromFields();
        }
      } catch (e) {
        console.error("Error al calcular envío:", e);

        // If quote fails, keep total consistent with current fields.
        updateTotalFromFields();

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
      if (!hasTotalsCore) return;

      const computed = computeSubtotalFromInlines();

      isProgrammaticSubtotalUpdate = true;
      setValue(subtotalEl, computed);

      // Keep total in sync immediately even before/without shipping quote.
      updateTotalFromFields();

      window.setTimeout(() => {
        isProgrammaticSubtotalUpdate = false;
      }, 0);

      // Only call quote when quote core exists and city is selected; otherwise local total is enough.
      if (hasQuoteCore) {
        const cityCodeNow = getValue(cityEl).trim();
        if (cityCodeNow) {
          await recalcQuote();
        }
      }
    };

    // Debounce for inline edits
    const recalcSubtotalAndQuoteDebounced = debounce(recalcSubtotalAndQuote, 200);
    const recalcQuoteDebounced = debounce(recalcQuote, 200);

    async function handleProductVariantChange(pvEl, forcedVariantId) {
      if (!pvEl) return;

      const variantId = String(forcedVariantId ?? getValue(pvEl) ?? "").trim();

      if (!variantId) {
        recalcSubtotalAndQuoteDebounced();
        return;
      }

      // 1) Intento: tomar el <tr> directo (cuando el event viene del <select>/<input>)
      let rowTr = pvEl.closest ? pvEl.closest("tr") : null;

      // 2) Fallback ultra confiable: derivar el id de fila desde el id del campo
      // Ej: id_items-1-product_variant -> fila <tr id="items-1">
      if (!rowTr) {
        const m = String(pvEl.id || "").match(
          /^id_([^-]+-\d+)-(product_variant|product_variant_id)(?:_\d+)?$/
        );
        if (m && m[1]) rowTr = document.getElementById(m[1]);
      }

      // Buscar el unit_price dentro de ESA fila
      let priceEl = null;
      if (rowTr) {
        priceEl = rowTr.querySelector('input[id$="-unit_price"]');
      }

      // Último fallback: por base (por si cambia el HTML)
      if (!priceEl) {
        const pvId = pvEl.id || "";
        if (pvId) {
          const base = pvId.replace(/-(product_variant|product_variant_id)(?:_\d+)?$/, "");
          priceEl =
            document.getElementById(`${base}-unit_price`) ||
            qs(`#${escapeId(base)}-unit_price`);
        }
      }

      try {
        const data = await fetchVariantPrice(variantId);

        const unitPrice =
          data && data.unit_price != null
            ? data.unit_price
            : data && data.price != null
              ? data.price
              : "";

        if (priceEl) {
          setValue(priceEl, unitPrice);
          priceEl.dataset.unitPrice = String(unitPrice == null ? "" : unitPrice);
        }
      } catch (e) {
        console.error("Error al obtener unit_price del variant:", e);
      }

      recalcSubtotalAndQuoteDebounced();
    }

    function wireProductVariantSelect2() {
      const selector =
        'select[id$="-product_variant"], select[id$="-product_variant_0"], ' +
        'select[id$="-product_variant_id"], select[id$="-product_variant_id_0"], ' +
        'input[id$="-product_variant"], input[id$="-product_variant_0"], ' +
        'input[id$="-product_variant_id"], input[id$="-product_variant_id_0"]';

      const selects = qsa(selector);
      if (!selects.length) return;

      // django.jQuery (admin) o jQuery global
      let $ = null;
      try {
        $ = window.django && window.django.jQuery ? window.django.jQuery : window.jQuery;
      } catch (e) {
        $ = null;
      }

      // 1) Wiring directo para los que ya existen
      for (const sel of selects) {
        if (sel.dataset && sel.dataset.pvSelect2Wired === "1") continue;
        if (sel.dataset) sel.dataset.pvSelect2Wired = "1";

        sel.addEventListener("change", function () {
          handleProductVariantChange(sel);
        });

        // Si ya tiene valor, precargar unit_price
        if (getValue(sel).trim()) {
          handleProductVariantChange(sel);
        }
      }

      // 2) Wiring delegado: cubre filas que Select2 inicializa/reinicializa después
      if ($ && !wireProductVariantSelect2._delegated) {
        wireProductVariantSelect2._delegated = true;

        $(document).on("select2:select", selector, function (e) {
          const id = e && e.params && e.params.data ? e.params.data.id : undefined;
          handleProductVariantChange(this, id);
        });

        $(document).on("select2:clear", selector, function () {
          handleProductVariantChange(this, "");
        });

        // Backup: algunos flujos solo disparan change
        $(document).on("change", selector, function () {
          handleProductVariantChange(this);
        });
      }
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

    // change city -> quote (and always keep total consistent)
    if (cityEl && hasQuoteCore) {
      cityEl.addEventListener("change", function () {
        recalcQuote();
        updateTotalFromFields();
      });
    }

    // input subtotal (manual edit) -> quote (but ignore programmatic updates)
    if (subtotalEl && hasTotalsCore) {
      subtotalEl.addEventListener("input", function () {
        if (isProgrammaticSubtotalUpdate) return;
        recalcQuoteDebounced();
      });
    }

    // shipping_cost manual edit -> update total immediately
    if (shippingEl && hasTotalsCore) {
      shippingEl.addEventListener("input", debounce(updateTotalFromFields, 50));
      shippingEl.addEventListener("change", updateTotalFromFields);
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
        // New inline row: re-wire select2/autocomplete and recalc totals
        wireProductVariantSelect2();
        recalcSubtotalAndQuoteDebounced();
      });
    }

    wireInlineEvents();
    wireProductVariantSelect2();

    // -----------------------------
    // Initial calculation
    // -----------------------------
    if (hasTotalsCore) {
      const hasInlineQty = qsa('input[id^="id_"]').some((el) => RE_QTY.test(el.id));
      if (hasInlineQty) {
        recalcSubtotalAndQuote();
      } else {
        // Ensure total is never left at 0 when subtotal exists.
        updateTotalFromFields();
        recalcQuote();
      }
    }
  });
})();