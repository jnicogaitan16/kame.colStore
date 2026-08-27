/**
 * Trust badges for checkout — security indicators shown before the payment button.
 */

import { PaymentLogosRow, WompiLogo } from "./PaymentLogos";

function LockIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function CheckoutTrustBadges() {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <LockIcon />
          Pago seguro
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldIcon />
          Datos protegidos
        </span>
      </div>
      <PaymentLogosRow compact />
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-400">
        Procesado por
        <WompiLogo className="inline-block h-8 w-auto text-zinc-400" />
      </p>
    </div>
  );
}
