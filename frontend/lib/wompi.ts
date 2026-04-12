/**
 * frontend/lib/wompi.ts
 * Helper para cargar el Widget de Wompi y sus tipos.
 *
 * Contrato:
 * - WOMPI_PUBLIC_KEY se lee desde NEXT_PUBLIC_WOMPI_PUBLIC_KEY (solo en frontend).
 * - WOMPI_INTEGRITY_SECRET NUNCA llega al frontend — la firma se genera en Django.
 * - El Widget se carga de forma lazy (solo cuando se necesita).
 *
 * Si en Red ves 404 `NOT_FOUND_ERROR` en `.../merchants/pub_.../check_pco_blacklist`, Wompi sandbox
 * no reconoce esa llave/comercio: revisá el panel Wompi y que `.env.local` coincida (reiniciá dev).
 */

const WOMPI_WIDGET_URL = "https://checkout.wompi.co/widget.js";

// ─────────────────────────────────────────────
// Tipos globales del Widget
// ─────────────────────────────────────────────

export interface WompiCustomerData {
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  phoneNumberPrefix?: string;
  legalId?: string;
  legalIdType?: string;
}

export interface WompiWidgetConfig {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  redirectUrl?: string;
  signature?: { integrity: string };
  customerData?: WompiCustomerData;
}

export type WompiTransactionStatus =
  | "APPROVED"
  | "DECLINED"
  | "ERROR"
  | "PENDING"
  | (string & {});

export interface WompiTransaction {
  id: string;
  status: WompiTransactionStatus;
  amount_in_cents?: number;
  reference?: string;
  payment_method_type?: string;
}

export interface WompiWidgetResult {
  transaction: WompiTransaction;
}

export interface WompiWidget {
  open: (callback: (result: WompiWidgetResult) => void) => void;
}

declare global {
  interface Window {
    WidgetCheckout: new (config: WompiWidgetConfig) => WompiWidget;
  }
}

// ─────────────────────────────────────────────
// Carga lazy del script (singleton)
// ─────────────────────────────────────────────

let _loadPromise: Promise<void> | null = null;

export function loadWompiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadWompiScript solo puede llamarse en el browser."));
  }

  if (typeof window.WidgetCheckout === "function") {
    return Promise.resolve();
  }

  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WOMPI_WIDGET_URL}"]`);
    if (existing) {
      // Script ya está en el DOM; esperar a que WidgetCheckout esté disponible
      const interval = setInterval(() => {
        if (typeof window.WidgetCheckout === "function") {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.src = WOMPI_WIDGET_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      _loadPromise = null;
      reject(new Error("No se pudo cargar el widget de Wompi. Verifica tu conexión."));
    };
    document.head.appendChild(script);
  });

  return _loadPromise;
}
