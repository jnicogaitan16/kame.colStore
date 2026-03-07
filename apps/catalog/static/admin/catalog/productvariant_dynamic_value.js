(function () {
  "use strict";

  const EMPTY_OPTION_TEXT = "---------";

  function isEmptyOptionText(value) {
    return normalizeChoice(value) === normalizeChoice(EMPTY_OPTION_TEXT);
  }

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

  function getJQ() {
    // Django admin ships its own jQuery at django.jQuery
    if (window.django && window.django.jQuery) return window.django.jQuery;
    if (window.jQuery) return window.jQuery;
    return null;
  }

  function normalizeValue(v) {
    return String(v || "").trim();
  }

  function normalizeChoice(v) {
    return String(v || "").trim().toLowerCase();
  }

  function readCurrentFieldValue(el) {
    if (!el) return "";

    if (typeof el.value === "string" && el.value.trim() && !isEmptyOptionText(el.value)) {
      return el.value;
    }

    const selectedOption =
      el.tagName === "SELECT" ? el.options[el.selectedIndex] || null : null;

    if (selectedOption) {
      if (
        typeof selectedOption.value === "string" &&
        selectedOption.value.trim() &&
        !isEmptyOptionText(selectedOption.value)
      ) {
        return selectedOption.value;
      }
      if (
        typeof selectedOption.text === "string" &&
        selectedOption.text.trim() &&
        !isEmptyOptionText(selectedOption.text)
      ) {
        return selectedOption.text;
      }
    }

    const attrValue = el.getAttribute("value");
    if (typeof attrValue === "string" && attrValue.trim() && !isEmptyOptionText(attrValue)) {
      return attrValue;
    }

    return "";
  }

  function applySelectValue(selectEl, persistedValue) {
    if (!selectEl || !persistedValue) return;

    const normalizedPersisted = normalizeChoice(persistedValue);
    const options = Array.from(selectEl.options || []);
    const exactMatch = options.find((option) => option.value === persistedValue);
    const normalizedValueMatch = options.find(
      (option) => normalizeChoice(option.value) === normalizedPersisted
    );
    const normalizedTextMatch = options.find(
      (option) => normalizeChoice(option.text) === normalizedPersisted
    );
    const match = exactMatch || normalizedValueMatch || normalizedTextMatch;

    if (match) {
      selectEl.value = match.value;
    }
  }

  function setFieldLabel(fieldId, text) {
    const label = document.querySelector('label[for="' + fieldId + '"]');
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
  function buildValueSelect(values, currentValue, className) {
    return buildSelect(className, currentValue, values);
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

  function setValueAsSelect(rule, valueFieldId, persistedValueOverride) {
    const fieldId = valueFieldId || "id_value";
    const fieldName = fieldId.replace(/^id_/, "");
    const current = $(fieldId);
    if (!current) return;

    const persistedValue = persistedValueOverride || readCurrentFieldValue(current);

    if (current.tagName && current.tagName.toLowerCase() === "select") {
      const next = buildSelect(current.className, persistedValue, rule.allowed_values);
      next.id = fieldId;
      next.name = fieldName;
      current.parentNode.replaceChild(next, current);
      applySelectValue(next, persistedValue);
      lastMode = "select";
      setFieldLabel(fieldId, rule.label || "Value");
      return;
    }

    const select = buildSelect(current.className, persistedValue, rule.allowed_values);
    select.id = fieldId;
    select.name = fieldName;
    current.parentNode.replaceChild(select, current);
    applySelectValue(select, persistedValue);

    lastMode = "select";
    setFieldLabel(fieldId, rule.label || "Value");
  }

  function setValueAsInput(valueFieldId, labelText) {
    const fieldId = valueFieldId || "id_value";
    const fieldName = fieldId.replace(/^id_/, "");
    const current = $(fieldId);
    if (!current) return;

    if (current.tagName && current.tagName.toLowerCase() === "input") {
      lastMode = "input";
      setFieldLabel(fieldId, labelText || "Value");
      return;
    }

    const input = buildInput(current.className, current.value);
    input.id = fieldId;
    input.name = fieldName;
    current.parentNode.replaceChild(input, current);

    lastMode = "input";
    setFieldLabel(fieldId, labelText || "Value");
  }

  function setColorLabel(text) {
    setFieldLabel("id_color", text || "Color");
  }

  function _buildColorSelect(className, currentValue, allowedColors) {
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
  function buildColorSelect(colors, currentValue, className) {
    return _buildColorSelect(className, currentValue, colors);
  }

  function setColorAsSelect(rule, colorFieldId, persistedColorOverride) {
    const fieldId = colorFieldId || "id_color";
    const fieldName = fieldId.replace(/^id_/, "");
    const current = $(fieldId);
    if (!current) return;

    setRowVisible(current, true);
    setFieldEnabled(current, true);

    const persistedColor = persistedColorOverride || readCurrentFieldValue(current);

    if (current.tagName && current.tagName.toLowerCase() === "select") {
      const next = _buildColorSelect(current.className, persistedColor, rule.allowed_colors);
      next.id = fieldId;
      next.name = fieldName;
      current.parentNode.replaceChild(next, current);
      applySelectValue(next, persistedColor);
      setFieldLabel(fieldId, rule.label || "Color");
      return;
    }

    const select = _buildColorSelect(current.className, persistedColor, rule.allowed_colors);
    select.id = fieldId;
    select.name = fieldName;
    current.parentNode.replaceChild(select, current);
    applySelectValue(select, persistedColor);
    setFieldLabel(fieldId, rule.label || "Color");
  }

  function hideColorFieldAndClear(colorFieldId, clearValue) {
    const fieldId = colorFieldId || "id_color";
    const current = $(fieldId);
    if (!current) return;
    if (clearValue !== false) {
      current.value = "";
    }
    setFieldEnabled(current, false);
    setRowVisible(current, false);
    setFieldLabel(fieldId, "Color");
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

  async function refreshFromProduct() {
    return refreshValueWidget();
  }

  async function fetchVariantRule(productId) {
    const base = getAdminBasePath();
    const url = base + "product-category/?product_id=" + encodeURIComponent(productId);

    const res = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    if (!res.ok) {
      console.warn("[ProductVariantAdmin] product-category endpoint failed", res.status);
      throw new Error("Category endpoint returned " + res.status);
    }

    return await res.json();
  }
  async function getCategoryFromProduct(productSelect) {
    if (!productSelect) return null;
    const productId = productSelect.value || "";
    if (!productId) return null;
    return fetchVariantRule(productId);
  }

  async function refreshValueWidget() {
    const productEl = $("id_product");

    // Never leave the widgets disabled waiting for a validation error.
    const valueEl0 = $("id_value");
    if (valueEl0) setFieldEnabled(valueEl0, true);
    const colorEl0 = $("id_color");
    if (colorEl0) setFieldEnabled(colorEl0, true);

    // No product field => safest fallback is input + allow save
    if (!productEl) {
      if (lastMode !== "input") setValueAsInput("id_value", "Value");
      setSaveButtonsEnabled(true);
      hideColorFieldAndClear("id_color");
      lastProductId = null;
      return;
    }

    const productId = productEl.value || "";

    // No product selected => input + allow save
    if (!productId) {
      if (lastMode !== "input") setValueAsInput("id_value", "Value");
      setSaveButtonsEnabled(true);
      hideColorFieldAndClear("id_color");
      lastProductId = null;
      return;
    }

    // If product didn't change, no work needed
    if (productId === lastProductId) return;
    lastProductId = productId;

    try {
      const rule = await getCategoryFromProduct(productEl);

      const allowedValues =
        rule.allowed_values ??
        rule.allowedValues ??
        rule.allowed ??
        rule.values ??
        [];

      const allowedColors =
        rule.allowed_colors ??
        rule.allowedColors ??
        rule.colors ??
        [];

      const schema = String(
        rule.variant_schema ?? rule.variantSchema ?? ""
      ).trim().toLowerCase();

      const shouldUseValueSelect = Boolean(
        (rule.use_select ?? rule.useSelect) && Array.isArray(allowedValues) && allowedValues.length
      );

      if (schema === "no_variant") {
        setValueAsInput("id_value", rule.label || "Value");
        const valueEl = $("id_value");
        if (valueEl) {
          valueEl.value = "";
          valueEl.setAttribute("value", "");
          setFieldEnabled(valueEl, false);
          setRowVisible(valueEl, false);
        }
        hideColorFieldAndClear("id_color");
        const colorEl = $("id_color");
        if (colorEl) {
          colorEl.value = "";
          colorEl.setAttribute("value", "");
        }
        setSaveButtonsEnabled(true);
        return;
      }

      if (shouldUseValueSelect) {
        setValueAsSelect(
          {
            label: rule.label || "Value",
            allowed_values: allowedValues,
          },
          "id_value"
        );
      } else {
        setValueAsInput("id_value", rule.label || "Value");
      }
      setSaveButtonsEnabled(true);

      const valueEl = $("id_value");
      if (valueEl) {
        setFieldEnabled(valueEl, true);
        setRowVisible(valueEl, true);
      }

      if (schema === "size_color") {
        const colorsArr = Array.isArray(allowedColors) ? allowedColors : [];
        if (colorsArr.length) {
          setColorAsSelect(
            {
              label: "Color",
              allowed_colors: colorsArr,
            },
            "id_color"
          );
        } else {
          const colorEl = $("id_color");
          if (colorEl) {
            setRowVisible(colorEl, true);
            setFieldEnabled(colorEl, true);
            setFieldLabel("id_color", "Color");
          }
        }
      } else if (schema === "jean_size" || schema === "shoe_size") {
        hideColorFieldAndClear("id_color");
        const colorEl = $("id_color");
        if (colorEl) {
          colorEl.value = "";
          colorEl.setAttribute("value", "");
        }
      } else {
        hideColorFieldAndClear("id_color");
      }
    } catch (e) {
      console.warn("[ProductVariantAdmin] Falling back to neutral widgets", e);
      // Conservative fallback: allow viewing/editing and allow save
      setValueAsInput("id_value", "Value");
      hideColorFieldAndClear("id_color");
      setSaveButtonsEnabled(true);
    }
  }

  window.KameAdminDynamicFields = Object.assign({}, window.KameAdminDynamicFields, {
    normalizeValue,
    setSaveButtonsEnabled,
    getFormRowForField,
    setRowVisible,
    setFieldEnabled,
    buildValueSelect,
    buildColorSelect,
    getCategoryFromProduct,
    setFieldLabel,
    setValueAsSelect,
    setValueAsInput,
    setColorAsSelect,
    hideColorFieldAndClear,
  });

  ready(function () {
    const productEl = $("id_product");

    // Vanilla change hook (works for non-select2 selects)
    if (productEl) {
      productEl.addEventListener("change", refreshFromProduct);
      // extra safety for widgets that change value without triggering change
      productEl.addEventListener("input", refreshFromProduct);
    }

    // Select2 hook (autocomplete_fields): delegate so it works after select2 initializes
    const jq = getJQ();
    if (jq) {
      jq(document).on("select2:select select2:clear", "#id_product", refreshFromProduct);
    }

    refreshFromProduct(); // run on load
  });
})();