(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function $(id) {
    return document.getElementById(id);
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
      variant_schema: String(rule.variant_schema || rule.variantSchema || "").trim(),
      category_slug: String(rule.category_slug || rule.categorySlug || "").trim().toLowerCase(),
    };
  }

  async function refreshInventoryPoolFields() {
    const shared = window.KameAdminDynamicFields;
    if (!shared) return;

    const categoryEl = $("id_category");
    const valueEl0 = $("id_value");
    const colorEl0 = $("id_color");
    const currentValue = valueEl0 ? valueEl0.value : "";
    const currentColor = colorEl0 ? colorEl0.value : "";

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
          shared.setFieldEnabled(valueEl, false);
          shared.setRowVisible(valueEl, false);
        }
        shared.hideColorFieldAndClear("id_color");
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
          "id_value"
        );
        const valueElAfter = $("id_value");
        if (valueElAfter && currentValue) {
          valueElAfter.value = currentValue;
        }
      } else {
        shared.setValueAsInput("id_value", rule.label || "Value");
        const valueElAfter = $("id_value");
        if (valueElAfter && currentValue) {
          valueElAfter.value = currentValue;
        }
      }

      const shouldUseColorSelect = Boolean(rule.allowed_colors.length);

      if (schema === "SIZE_COLOR") {
        if (shouldUseColorSelect) {
          shared.setColorAsSelect(
            {
              label: "Color",
              allowed_colors: rule.allowed_colors,
            },
            "id_color"
          );
          const colorElAfter = $("id_color");
          if (colorElAfter && currentColor) {
            colorElAfter.value = currentColor;
          }
        } else {
          const colorEl = $("id_color");
          if (colorEl) {
            shared.setRowVisible(colorEl, true);
            shared.setFieldEnabled(colorEl, true);
            shared.setFieldLabel("id_color", "Color");
          }
        }
      } else if (schema === "JEAN_SIZE") {
        if (shouldUseColorSelect) {
          shared.setColorAsSelect(
            {
              label: "Color",
              allowed_colors: rule.allowed_colors,
            },
            "id_color"
          );
          const colorElAfter = $("id_color");
          if (colorElAfter && currentColor) {
            colorElAfter.value = currentColor;
          }
        } else {
          const colorEl = $("id_color");
          if (colorEl) {
            shared.setRowVisible(colorEl, true);
            shared.setFieldEnabled(colorEl, true);
            shared.setFieldLabel("id_color", "Color");
          }
        }
      } else if (schema === "DIMENSION") {
        shared.hideColorFieldAndClear("id_color");
      } else {
        if (shouldUseColorSelect) {
          shared.setColorAsSelect(
            {
              label: "Color",
              allowed_colors: rule.allowed_colors,
            },
            "id_color"
          );
          const colorElAfter = $("id_color");
          if (colorElAfter && currentColor) {
            colorElAfter.value = currentColor;
          }
        } else {
          shared.hideColorFieldAndClear("id_color");
        }
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

    categoryEl.addEventListener("change", function () {
      refreshInventoryPoolFields();
    });

    categoryEl.addEventListener("input", function () {
      refreshInventoryPoolFields();
    });

    refreshInventoryPoolFields();
  });
})();
