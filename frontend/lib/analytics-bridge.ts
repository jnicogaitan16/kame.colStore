/**
 * Analytics bridge — maps internal KameTracker events to GA4 (gtag) and Meta Pixel (fbq).
 *
 * Called from useTracking hooks. Does NOT modify KameTracker — the bridge lives
 * at the hook layer, firing in parallel with the internal tracker.
 */

type GtagEvent = {
  event_name: string;
  params: Record<string, unknown>;
};

type FbqEvent = {
  event_name: string;
  params: Record<string, unknown>;
} | null;

function mapToGA4(
  event: string,
  data: Record<string, unknown>
): GtagEvent | null {
  switch (event) {
    case "product_view":
      return {
        event_name: "view_item",
        params: {
          currency: "COP",
          value: data.price || 0,
          items: [
            {
              item_id: data.product_id,
              item_name: data.product_name,
              price: data.price || 0,
            },
          ],
        },
      };
    case "product_click":
      return {
        event_name: "select_item",
        params: {
          items: [
            {
              item_id: data.product_id,
              item_name: data.product_name,
            },
          ],
        },
      };
    case "add_to_cart":
      return {
        event_name: "add_to_cart",
        params: {
          currency: "COP",
          value: data.price || 0,
          items: [
            {
              item_id: data.product_id,
              item_name: data.product_name,
              price: data.price || 0,
              quantity: data.quantity || 1,
              item_variant: data.variant,
            },
          ],
        },
      };
    case "checkout_start":
      return {
        event_name: "begin_checkout",
        params: {
          currency: "COP",
          value: data.value || 0,
          items: data.items || [],
        },
      };
    case "purchase_complete":
      return {
        event_name: "purchase",
        params: {
          transaction_id: data.step || data.reference,
          currency: "COP",
          value: data.price || data.total || 0,
          shipping: data.shipping || 0,
          items: data.items || [],
        },
      };
    default:
      return null;
  }
}

function mapToFbq(
  event: string,
  data: Record<string, unknown>
): FbqEvent {
  switch (event) {
    case "product_view":
      return {
        event_name: "ViewContent",
        params: {
          content_ids: [data.product_id],
          content_type: "product",
          content_name: data.product_name,
          value: data.price || 0,
          currency: "COP",
        },
      };
    case "add_to_cart":
      return {
        event_name: "AddToCart",
        params: {
          content_ids: [data.product_id],
          content_type: "product",
          content_name: data.product_name,
          value: data.price || 0,
          currency: "COP",
        },
      };
    case "checkout_start":
      return {
        event_name: "InitiateCheckout",
        params: {
          content_ids: data.content_ids || [],
          num_items: data.num_items || 0,
          value: data.value || 0,
          currency: "COP",
        },
      };
    case "purchase_complete":
      return {
        event_name: "Purchase",
        params: {
          content_ids: data.content_ids || [],
          value: data.price || data.total || 0,
          currency: "COP",
        },
      };
    default:
      return null;
  }
}

/**
 * Emit an internal tracker event to GA4 and Meta Pixel simultaneously.
 * Safe to call in any environment — no-ops when gtag/fbq are not loaded.
 */
export function emitToExternalAnalytics(
  event: string,
  data: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") return;

  // GA4
  const ga4 = mapToGA4(event, data);
  if (ga4 && typeof window.gtag === "function") {
    window.gtag("event", ga4.event_name, ga4.params);
  }

  // Meta Pixel
  const fb = mapToFbq(event, data);
  if (fb && typeof window.fbq === "function") {
    window.fbq("track", fb.event_name, fb.params);
  }
}
