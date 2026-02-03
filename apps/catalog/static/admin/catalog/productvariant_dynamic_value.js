(function () {
  "use strict";

  const EMPTY_OPTION_TEXT = "---------";

  const DEFAULT_CAMISETA_VALUES = null; // o ["S","M","L","XL","2XL"] como fallback mínimo
  const DEFAULT_APPAREL_COLORS = null; // o ["Blanco","Negro",...] como fallback mínimo

  function normalizeSlug(v) {
    return String(v || "").trim().toLowerCase();
  }

  let lastProductId = null;
  let lastMode = null; // "select" | "input"

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeValue(v) {
    return String(v || "").trim();
  }

  function setValueLabel(text) {
    const label = document.querySelector('label[for="id_value"]');
    if (label) label.textContent = text + ":";
  }

  function setSaveButtonsEnabled(enabled) {
    const row = document.querySelector(".submit-row");
    if (!row) return;

    const buttons = row.querySelectorAll('input[type="submit"], button[type="submit"]');
    buttons.forEach((b) => {
      b.disabled = !enabled;
      b.classList.toggle("disabled", !enabled);
    });
  }

  function getFormRowForField(inputEl) {
    if (!inputEl) return null;
    // Django admin typically wraps fields in .form-row
    return inputEl.closest?.(".form-row") || null;
  }

  function setRowVisible(inputEl, visible) {
    const row = getFormRowForField(inputEl);
    if (!row) return;
    row.style.display = visible ? "" : "none";
  }

  function setFieldEnabled(inputEl, enabled) {
    if (!inputEl) return;
    inputEl.disabled = !enabled;
  }

  function buildSelect(className, currentValue, allowedValues) {
    const select = document.createElement("select");
    select.id = "id_value";
    select.name = "value";
    select.className = className || "";
    select.classList.add("vTextField");

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = EMPTY_OPTION_TEXT;
    select.appendChild(empty);

    (allowedValues || []).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

    const norm = normalizeValue(currentValue);
    if ((allowedValues || []).includes(norm)) select.value = norm;

    return select;
  }

  function buildInput(className, currentValue) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "id_value";
    input.name = "value";
    input.className = className || "";
    input.value = normalizeValue(currentValue);
    return input;
  }

  function setValueAsSelect(rule) {
    const current = $("id_value");
    if (!current) return;

    if (current.tagName && current.tagName.toLowerCase() === "select") {
      // Ensure options are in sync even if we're already a select
      const next = buildSelect(current.className, current.value, rule.allowed_values);
      current.parentNode.replaceChild(next, current);
      lastMode = "select";
      setValueLabel(rule.label || "Value");
      return;
    }

    const select = buildSelect(current.className, current.value, rule.allowed_values);
    current.parentNode.replaceChild(select, current);

    lastMode = "select";
    setValueLabel(rule.label || "Value");
  }

  function setValueAsInput() {
    const current = $("id_value");
    if (!current) return;

    if (current.tagName && current.tagName.toLowerCase() === "input") {
      lastMode = "input";
      setValueLabel("Value");
      return;
    }

    const input = buildInput(current.className, current.value);
    current.parentNode.replaceChild(input, current);

    lastMode = "input";
    setValueLabel("Value");
  }

  function setColorLabel(text) {
    const label = document.querySelector('label[for="id_color"]');
    if (label) label.textContent = text + ":";
  }

  function buildColorSelect(className, currentValue, allowedColors) {
    const select = document.createElement("select");
    select.id = "id_color";
    select.name = "color";
    select.className = className || "";
    select.classList.add("vTextField");

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = EMPTY_OPTION_TEXT;
    select.appendChild(empty);

    (allowedColors || []).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });

    const norm = normalizeValue(currentValue);
    if ((allowedColors || []).includes(norm)) select.value = norm;

    return select;
  }

  function setColorAsSelect(rule) {
    const current = $("id_color");
    if (!current) return;

    setRowVisible(current, true);
    setFieldEnabled(current, true);

    if (current.tagName && current.tagName.toLowerCase() === "select") {
      const next = buildColorSelect(current.className, current.value, rule.allowed_colors);
      current.parentNode.replaceChild(next, current);
      setColorLabel(rule.label || "Color");
      return;
    }

    const select = buildColorSelect(current.className, current.value, rule.allowed_colors);
    current.parentNode.replaceChild(select, current);
    setColorLabel(rule.label || "Color");
  }

  function hideColorFieldAndClear() {
    const current = $("id_color");
    if (!current) return;
    // Prevent submitting obsolete color values
    current.value = "";
    setFieldEnabled(current, false);
    setRowVisible(current, false);
    setColorLabel("Color");
  }

  function getAdminBasePath() {
    // Example paths:
    // /admin/catalog/productvariant/add/
    // /admin/catalog/productvariant/12/change/
    // We want: /admin/catalog/productvariant/
    //
    // IMPORTANT: In a real .js file this is a regex literal,
    // so do NOT double-escape backslashes.
    return window.location.pathname.replace(/(add|\d+\/change)\/?$/, "");
  }

  async function fetchVariantRule(productId) {
    const base = getAdminBasePath();
    const url = base + "product-category/?product_id=" + encodeURIComponent(productId);

    const res = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    if (!res.ok) {
      throw new Error("Category endpoint returned " + res.status);
    }

    return await res.json();
  }

  async function refreshValueWidget() {
    const productEl = $("id_product");

    // No product field => safest fallback is input + allow save
    if (!productEl) {
      if (lastMode !== "input") setValueAsInput();
      setSaveButtonsEnabled(true);
      hideColorFieldAndClear();
      lastProductId = null;
      return;
    }

    const productId = productEl.value || "";

    // No product selected => input + allow save
    if (!productId) {
      if (lastMode !== "input") setValueAsInput();
      setSaveButtonsEnabled(true);
      hideColorFieldAndClear();
      lastProductId = null;
      return;
    }

    // If product didn't change, no work needed
    if (productId === lastProductId) return;
    lastProductId = productId;

    try {
      const rule = await fetchVariantRule(productId);

      // Backwards/forwards compatible parsing (snake_case / camelCase / minimal payload)
      const allowedValues =
        rule.allowed_values ??
        rule.allowedValues ??
        rule.allowed ??
        rule.values ??
        null;

      const allowedColors =
        rule.allowed_colors ??
        rule.allowedColors ??
        rule.colors ??
        null;

      const categorySlug = normalizeSlug(
        rule.category_slug ?? rule.categorySlug ?? rule.category ?? rule.slug ?? ""
      );

      const isApparel = categorySlug === "camisetas" || categorySlug === "hoodies";

      const shouldUseSelect = Boolean(rule.use_select ?? rule.useSelect) || isApparel;

      if (shouldUseSelect) {
        setValueAsSelect({
          label: rule.label || (isApparel ? "Talla" : "Value"),
          allowed_values:
            Array.isArray(allowedValues) && allowedValues.length
              ? allowedValues
              : isApparel
                ? DEFAULT_CAMISETA_VALUES
                : [],
        });
      } else {
        setValueAsInput();
      }
      setSaveButtonsEnabled(true);

      // Color: only for apparel categories (camisetas/hoodies)
      if (isApparel) {
        const colorsArr =
          Array.isArray(allowedColors) && allowedColors.length
            ? allowedColors
            : DEFAULT_APPAREL_COLORS || [];

        setColorAsSelect({
          label: "Color",
          allowed_colors: colorsArr,
        });
      } else {
        hideColorFieldAndClear();
      }
    } catch (e) {
      // Conservative fallback: allow viewing/editing and allow save
      setValueAsInput();
      hideColorFieldAndClear();
      setSaveButtonsEnabled(true);
    }
  }

  ready(function () {
    const productEl = $("id_product");
    if (productEl) {
      productEl.addEventListener("change", refreshValueWidget);
      // extra safety for widgets that change value without triggering change
      productEl.addEventListener("input", refreshValueWidget);
    }
    refreshValueWidget(); // run on load
  });
})();