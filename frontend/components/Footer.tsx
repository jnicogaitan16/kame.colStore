import Link from "next/link";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm10 2a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm4.5-.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M21 8.5c-1.8 0-3.4-.6-4.7-1.6V15a6 6 0 11-6-6c.3 0 .7 0 1 .1v3a3 3 0 10 3 3V2h2.7c.2 1.8 1.7 3.3 3.5 3.6v2.9z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 10-11.6 9.9v-7H8v-3h2.4V9.5c0-2.4 1.4-3.7 3.6-3.7 1 0 2 .2 2 .2v2.2h-1.1c-1.1 0-1.4.7-1.4 1.4V12H16l-.4 3h-2.3v7A10 10 0 0022 12z" />
    </svg>
  );
}

export default function Footer() {
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  const tiktokUrl = process.env.NEXT_PUBLIC_TIKTOK_URL;
  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL;
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <footer className="bg-neutral-900 text-neutral-200">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="mb-3 text-xl font-semibold text-white">Kame.col</h3>
            <p className="max-w-md text-sm leading-relaxed text-neutral-400">
              Marca independiente de arte y diseño. Camisetas, hoodies y piezas
              personalizadas creadas con identidad urbana y cuidado por el
              detalle.
            </p>
          </div>

          {/* Social */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">
              Síguenos
            </h4>
            <ul className="space-y-3 text-sm">
              {instagramUrl ? (
                <li>
                  <a href={instagramUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                    <InstagramIcon /> Instagram
                  </a>
                </li>
              ) : null}
              {tiktokUrl ? (
                <li>
                  <a href={tiktokUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                    <TikTokIcon /> TikTok
                  </a>
                </li>
              ) : null}
              {facebookUrl ? (
                <li>
                  <a href={facebookUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                    <FacebookIcon /> Facebook
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">
              Contacto
            </h4>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li>Bogotá, Colombia</li>
              {contactEmail ? (
                <li>
                  <a href={`mailto:${contactEmail}`} className="hover:text-white">
                    {contactEmail}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-12 border-t border-neutral-800 pt-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-neutral-500 md:flex-row">
            <span>© {new Date().getFullYear()} Kame.col. Todos los derechos reservados.</span>
            <div className="flex gap-4">
              <Link href="/legal/politica-de-privacidad#terminos" className="hover:text-neutral-300">Términos</Link>
              <Link href="/legal/politica-de-privacidad#privacidad" className="hover:text-neutral-300">Privacidad</Link>
              <Link href="/legal/politica-de-privacidad#cookies" className="hover:text-neutral-300">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}