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

function TagIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1,4 1,10 7,10" />
      <polyline points="23,20 23,14 17,14" />
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
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
        <TagIcon />
        <span className="text-sm text-zinc-500">Envio gratis desde $170.000</span>
      </div>
      <div className="flex items-center gap-2.5">
        <RefreshIcon />
        <Link href="/legal/devoluciones" className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline">
          Cambios y devoluciones
        </Link>
      </div>
    </div>
  );
}
