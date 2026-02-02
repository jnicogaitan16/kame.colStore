(function () {
  "use strict";

  const SIZES = ["S", "M", "L", "XL", "2XL"];
  const CAMISETAS_SLUG = "camisetas";
  const EMPTY_OPTION_TEXT = "---------";

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
    return String(v || "").trim().toUpperCase();
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

  function buildSelect(className, currentValue) {
    const select = document.createElement("select");
    select.id = "id_value";
    select.name = "value";
    select.className = className || "";

    // Empty option (admin style)
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = EMPTY_OPTION_TEXT;
    select.appendChild(empty);

    SIZES.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

    const norm = normalizeValue(currentValue);
    if (SIZES.includes(norm)) select.value = norm;

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

  function setValueAsSelect() {
    const current = $("id_value");
    if (!current) return;

    if (current.tagName && current.tagName.toLowerCase() === "select") {
      lastMode = "select";
      setValueLabel("Talla");
      return;
    }

    const select = buildSelect(current.className, current.value);
    current.parentNode.replaceChild(select, current);

    lastMode = "select";
    setValueLabel("Talla");
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

  async function fetchCategorySlug(productId) {
    const base = getAdminBasePath();
    const url = base + "product-category/?product_id=" + encodeURIComponent(productId);

    const res = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });

    if (!res.ok) {
      throw new Error("Category endpoint returned " + res.status);
    }

    const data = await res.json();
    return data && data.category_slug ? String(data.category_slug).toLowerCase() : "";
  }

  async function refreshValueWidget() {
    const productEl = $("id_product");

    // No product field => safest fallback is input + allow save
    if (!productEl) {
      if (lastMode !== "input") setValueAsInput();
      setSaveButtonsEnabled(true);
      lastProductId = null;
      return;
    }

    const productId = productEl.value || "";

    // No product selected => input + allow save
    if (!productId) {
      if (lastMode !== "input") setValueAsInput();
      setSaveButtonsEnabled(true);
      lastProductId = null;
      return;
    }

    // If product didn't change, no work needed
    if (productId === lastProductId) return;
    lastProductId = productId;

    try {
      const slug = await fetchCategorySlug(productId);

      if (slug === CAMISETAS_SLUG) {
        setValueAsSelect();
        setSaveButtonsEnabled(true);
      } else {
        setValueAsInput();
        setSaveButtonsEnabled(true);
      }
    } catch (e) {
      // Conservative fallback: allow viewing/editing and allow save
      setValueAsInput();
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