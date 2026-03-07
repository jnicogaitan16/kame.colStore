(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeChoice(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isEmptyOptionText(value) {
    return normalizeChoice(value) === normalizeChoice("---------");
  }

  function isInventoryPoolChangeView() {
    return /\/inventorypool\/\d+\/change\/?$/.test(window.location.pathname);
  }

  function isInventoryPoolAddView() {
    return /\/inventorypool\/add\/?$/.test(window.location.pathname);
  }

  function extractInventoryPoolPartsFromHeading() {
    if (!isInventoryPoolChangeView()) return { value: "", color: "" };

    function parseInventoryPoolLabel(text) {
      const raw = String(text || "").trim();
      if (!raw) return { value: "", color: "" };

      const normalized = raw
        .replace(/^change\s+inventory\s+pool\s*/i, "")
        .replace(/^change\s+/i, "")
        .trim();

      if (!normalized || normalized.indexOf("/") === -1) {
        return { value: "", color: "" };
      }

      const withoutQty = normalized.replace(/\s*=\s*[^=]+$/, "").trim();
      const parts = withoutQty
        .split("/")
        .map(function (part) {
          return String(part || "").trim();
        })
        .filter(Boolean);

      if (parts.length < 3) return { value: "", color: "" };

      return {
        value: parts[1] || "",
        color: parts[2] || "",
      };
    }

    const candidates = [];

    const breadcrumbs = document.querySelector(".breadcrumbs");
    if (breadcrumbs && breadcrumbs.textContent) {
      const crumbs = breadcrumbs.textContent
        .split("›")
        .map(function (part) {
          return String(part || "").trim();
        })
        .filter(Boolean);

      if (crumbs.length) {
        candidates.push(crumbs[crumbs.length - 1]);
      }
    }

    const content = document.getElementById("content");
    if (content) {
      const textNodes = Array.from(content.querySelectorAll("h1, h2, h3, .breadcrumbs, caption, legend, strong, p, div"));
      textNodes.forEach(function (node) {
        const text = node && node.textContent ? node.textContent.trim() : "";
        if (text && text.indexOf("/") !== -1) {
          candidates.push(text);
        }
      });
    }

    candidates.push(document.title || "");

    for (let i = 0; i < candidates.length; i += 1) {
      const parsed = parseInventoryPoolLabel(candidates[i]);
      if (parsed.value || parsed.color) {
        return parsed;
      }
    }

    return { value: "", color: "" };
  }

  function getPersistedInventoryPoolValueFallback() {
    return extractInventoryPoolPartsFromHeading().value || "";
  }

  function getPersistedInventoryPoolColorFallback() {
    return extractInventoryPoolPartsFromHeading().color || "";
  }

  function getJQ() {
    return window.jQuery || window.django && window.django.jQuery || null;
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

  function restoreFieldValue(fieldId, persistedValue) {
    const el = $(fieldId);
    if (!el || !persistedValue) return;

    const normalizedPersisted = normalizeChoice(persistedValue);

    if (el.tagName === "SELECT") {
      const options = Array.from(el.options || []);
      const exactMatch = options.find((option) => option.value === persistedValue);
      const normalizedValueMatch = options.find(
        (option) => normalizeChoice(option.value) === normalizedPersisted
      );
      const normalizedTextMatch = options.find(
        (option) => normalizeChoice(option.text) === normalizedPersisted
      );
      const match = exactMatch || normalizedValueMatch || normalizedTextMatch;

      if (match) {
        el.value = match.value;
        el.setAttribute("value", match.value);

        if (window.django && window.django.jQuery) {
          window.django.jQuery(el).trigger("change");
        } else if (window.jQuery) {
          window.jQuery(el).trigger("change");
        }
      }
      return;
    }

    el.value = persistedValue;
  }

  function getAdminBasePath() {
    const match = window.location.pathname.match(/^(.*\/inventorypool\/)/);
    return match ? match[1] : "/admin/catalog/inventorypool/";
  }

  async function fetchCategoryRule(categoryId) {
    const base = getAdminBasePath();
    const url = base + "category-rule/?category_id=" + encodeURIComponent(categoryId);
    const response = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error("Unable to load category rule");
    }
    return response.json();
  }

  function normalizeRule(rule) {
    return {
      label: rule.label || "Value",
      use_select: Boolean(rule.use_select ?? rule.useSelect),
      allowed_values: Array.isArray(rule.allowed_values)
        ? rule.allowed_values
        : Array.isArray(rule.allowedValues)
          ? rule.allowedValues
          : [],
      allowed_colors: Array.isArray(rule.allowed_colors)
        ? rule.allowed_colors
        : Array.isArray(rule.allowedColors)
          ? rule.allowedColors
          : [],
      variant_schema: String(rule.variant_schema || rule.variantSchema || "").trim().toUpperCase(),
      category_slug: String(rule.category_slug || rule.categorySlug || "").trim().toLowerCase(),
    };
  }

  async function refreshInventoryPoolFields() {
    const shared = window.KameAdminDynamicFields;
    if (!shared) return;

    const categoryEl = $("id_category");
    const valueEl0 = $("id_value");
    const colorEl0 = $("id_color");
    const currentValue =
      readCurrentFieldValue(valueEl0) ||
      (isInventoryPoolChangeView() ? getPersistedInventoryPoolValueFallback() : "");
    const currentColor =
      readCurrentFieldValue(colorEl0) ||
      (isInventoryPoolChangeView() ? getPersistedInventoryPoolColorFallback() : "");
    const persistedParts = isInventoryPoolChangeView()
      ? extractInventoryPoolPartsFromHeading()
      : { value: "", color: "" };

    if (valueEl0) shared.setFieldEnabled(valueEl0, true);
    if (colorEl0) shared.setFieldEnabled(colorEl0, true);

    if (!categoryEl) {
      shared.setValueAsInput("id_value", "Value");
      shared.hideColorFieldAndClear("id_color");
      return;
    }

    const categoryId = categoryEl.value || "";

    if (!categoryId) {
      shared.setValueAsInput("id_value", "Value");
      shared.hideColorFieldAndClear("id_color");
      return;
    }

    try {
      const rawRule = await fetchCategoryRule(categoryId);
      const rule = normalizeRule(rawRule);
      const schema = rule.variant_schema || "";

      if (schema === "NO_VARIANT") {
        shared.setValueAsInput("id_value", rule.label || "Value");
        shared.hideColorFieldAndClear("id_color");

        const valueEl = $("id_value");
        if (valueEl) {
          valueEl.value = "";
          valueEl.setAttribute("value", "");
          shared.setFieldEnabled(valueEl, false);
          shared.setRowVisible(valueEl, false);
        }

        const colorEl = $("id_color");
        if (colorEl) {
          colorEl.value = "";
          colorEl.setAttribute("value", "");
          shared.setFieldEnabled(colorEl, false);
          shared.setRowVisible(colorEl, false);
        }
        return;
      }

      const valueEl = $("id_value");
      if (valueEl) {
        shared.setFieldEnabled(valueEl, true);
        shared.setRowVisible(valueEl, true);
      }

      const shouldUseValueSelect = Boolean(rule.use_select && rule.allowed_values.length);

      if (shouldUseValueSelect) {
        shared.setValueAsSelect(
          {
            label: rule.label || "Value",
            allowed_values: rule.allowed_values,
          },
          "id_value",
          currentValue || persistedParts.value
        );
        restoreFieldValue("id_value", currentValue || persistedParts.value);
      } else {
        shared.setValueAsInput("id_value", rule.label || "Value");
        restoreFieldValue("id_value", currentValue || persistedParts.value);
      }

      const colorEl = $("id_color");

      if (schema === "SIZE_COLOR") {
        const shouldUseColorSelect = Boolean(rule.allowed_colors.length);

        if (shouldUseColorSelect) {
          shared.setColorAsSelect(
            {
              label: "Color",
              allowed_colors: rule.allowed_colors,
            },
            "id_color",
            currentColor || persistedParts.color
          );
          restoreFieldValue("id_color", currentColor || persistedParts.color);
        } else if (colorEl) {
          shared.setRowVisible(colorEl, true);
          shared.setFieldEnabled(colorEl, true);
          shared.setFieldLabel("id_color", "Color");
        }
      } else if (schema === "JEAN_SIZE" || schema === "SHOE_SIZE") {
        shared.hideColorFieldAndClear("id_color");
        const hiddenColorEl = $("id_color");
        if (hiddenColorEl) {
          hiddenColorEl.value = "";
          hiddenColorEl.setAttribute("value", "");
        }
      } else {
        shared.hideColorFieldAndClear("id_color");
      }
    } catch (error) {
      console.warn("[InventoryPoolAdmin] Falling back to neutral widgets", error);
      const sharedFallback = window.KameAdminDynamicFields;
      if (!sharedFallback) return;
      sharedFallback.setValueAsInput("id_value", "Value");
      sharedFallback.setFieldEnabled($("id_value"), true);
      sharedFallback.hideColorFieldAndClear("id_color");
      sharedFallback.setRowVisible($("id_value"), true);
    }
  }

  ready(function () {
    const categoryEl = $("id_category");
    if (!categoryEl) return;

    const runRefresh = function () {
      window.setTimeout(function () {
        refreshInventoryPoolFields();
      }, 0);
    };

    categoryEl.addEventListener("change", runRefresh);
    categoryEl.addEventListener("input", runRefresh);

    const jq = getJQ();
    if (jq) {
      jq(document).on("select2:select select2:clear change", "#id_category", runRefresh);
    }

    refreshInventoryPoolFields();
  });
})();
