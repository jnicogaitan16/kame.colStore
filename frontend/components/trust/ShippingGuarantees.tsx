/**
 * Shipping & guarantee trust signals for PDP — shown below purchase buttons.
 */

import Link from "next/link";

function TruckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16,8 20,8 23,11 23,16 16,16" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

export function ShippingGuarantees() {
  return (
    <div className="mt-6 space-y-2.5 border-t border-zinc-900/8 pt-5">
      <div className="flex items-center gap-2.5">
        <TruckIcon />
        <span className="text-sm text-zinc-500">Envios a toda Colombia</span>
      </div>
      <div className="flex items-center gap-2.5">
        <ShieldIcon />
        <span className="text-sm text-zinc-500">Envio gratis desde $170.000</span>
      </div>
      <div className="flex items-center gap-2.5">
        <ClockIcon />
        <Link href="/legal/devoluciones" className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline">
          Cambios y devoluciones
        </Link>
      </div>
    </div>
  );
}
