


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
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12.2 7.8c-4.86 0-8.8 3.73-8.8 8.34 0 2.32 1 4.41 2.63 5.92L4.8 26.4l4.8-1.8c.8.24 1.66.36 2.6.36 4.86 0 8.8-3.73 8.8-8.32 0-4.62-3.94-8.36-8.8-8.36Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.2 11.2c3.96 0 7.2 3.03 7.2 6.78 0 1.88-.8 3.58-2.12 4.78l.98 3.02-3.44-1.28c-.66.18-1.36.28-2.1.28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function normalizePhone(phone: string) {
  return String(phone || "").replace(/\D/g, "");
}

function buildWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = normalizePhone(phone);
  const text = encodeURIComponent(message);
  // wa.me funciona bien en mobile/desktop y redirige a app/web
  return `https://wa.me/${normalizedPhone}?text=${text}`;
}

export default function WhatsAppButton({
  phone,
  message = "Hola 👋 Me interesa un producto de Kame.col. ¿Me ayudas con información?",
  className = "",
}: Props) {
  const normalizedPhone = normalizePhone(phone);
  const href = buildWhatsAppUrl(normalizedPhone, message);

  // Si no hay phone válido, no renderiza (evita links rotos)
  if (!normalizedPhone) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Abrir WhatsApp"
      className={
        "group fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))] z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-lg transition-all duration-200 ease-out hover:shadow-xl hover:opacity-95 hover:scale-[1.04] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-black motion-reduce:transition-none motion-reduce:hover:scale-100 " +
        className
      }
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-white/35 blur-[2px] animate-ping motion-reduce:animate-none"
      />
      <WhatsAppIcon className="relative h-6 w-6" />
      <span
        className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 md:block"
        aria-hidden="true"
      >
        ¿Necesitas ayuda? Escríbenos
      </span>
    </a>
  );
}
