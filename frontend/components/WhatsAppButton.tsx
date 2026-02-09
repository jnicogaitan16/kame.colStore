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
        "fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green-400 " +
        className
      }
    >
      {/* Ícono simple (sin dependencias). Si luego quieres, lo cambiamos por lucide-react */}
      <span className="text-xl" aria-hidden="true">
        💬
      </span>
    </Link>
  );
}
