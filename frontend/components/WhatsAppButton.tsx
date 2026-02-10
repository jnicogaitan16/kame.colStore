"use client";

import Link from "next/link";


type Props = {
  /** Número en formato internacional sin + ni espacios. Ej: 573001112233 */
  phone: string;
  /** Mensaje predefinido */
  message?: string;
  /** Clase adicional opcional */
  className?: string;
};

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.01 3.2c-7.1 0-12.88 5.78-12.88 12.88 0 2.27.6 4.5 1.74 6.47L3 29l6.6-1.72a12.8 12.8 0 006.41 1.71h.01c7.1 0 12.88-5.78 12.88-12.88S23.11 3.2 16.01 3.2zm0 23.5c-2.04 0-4.04-.55-5.78-1.6l-.41-.24-3.92 1.02 1.04-3.82-.27-.39a10.65 10.65 0 01-1.63-5.7c0-5.88 4.78-10.66 10.66-10.66S26.67 10.1 26.67 16s-4.78 10.7-10.66 10.7zm5.84-8.02c-.32-.16-1.9-.94-2.2-1.05-.3-.11-.52-.16-.74.16-.21.32-.85 1.05-1.04 1.27-.19.21-.38.24-.7.08-.32-.16-1.34-.5-2.55-1.6-.94-.84-1.58-1.88-1.77-2.2-.19-.32-.02-.49.14-.65.15-.15.32-.38.49-.57.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.74-1.78-1.01-2.44-.27-.64-.55-.55-.74-.56h-.63c-.21 0-.56.08-.85.4-.3.32-1.12 1.1-1.12 2.68 0 1.58 1.15 3.1 1.31 3.32.16.21 2.27 3.46 5.5 4.86.77.33 1.37.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.53.27-.74.27-1.38.19-1.53-.08-.15-.29-.24-.61-.4z"></path>
    </svg>
  );
}

function buildWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  const text = encodeURIComponent(message);
  // wa.me funciona bien en mobile/desktop y redirige a app/web
  return `https://wa.me/${normalizedPhone}?text=${text}`;
}

export default function WhatsAppButton({
  phone,
  message = "Hola 👋 Me interesa un producto de Kame.col. ¿Me ayudas con información?",
  className = "",
}: Props) {
  const href = buildWhatsAppUrl(phone, message);

  // Si no hay phone, no renderiza (evita links rotos)
  if (!phone) return null;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Abrir WhatsApp"
      className={
        "group fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-all duration-200 ease-out hover:shadow-xl hover:opacity-95 hover:scale-[1.04] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-white motion-reduce:transition-none motion-reduce:hover:scale-100 " +
        className
      }
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-green-500/30 blur-[2px] animate-ping motion-reduce:animate-none"
      />
      <WhatsAppIcon className="relative h-6 w-6" />
      <span
        className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 md:block"
        aria-hidden="true"
      >
        ¿Necesitas ayuda? Escríbenos
      </span>
    </Link>
  );
}
