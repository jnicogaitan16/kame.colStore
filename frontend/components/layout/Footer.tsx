import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
} from "@/components/ui/social-icons";

export default function Footer() {
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  const tiktokUrl = process.env.NEXT_PUBLIC_TIKTOK_URL;
  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL;
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <footer className="footer-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-14">
        <div className="grid items-start gap-10 md:grid-cols-4 md:gap-x-10 md:gap-y-8">
          {/* Brand */}
          <div className="text-center md:col-span-2 md:text-left">
            <h3 className="type-brand mb-3 text-zinc-950">Kame.col</h3>
            <p className="type-body mx-auto max-w-md text-zinc-700/90 md:mx-0">
            Prendas urbanas con enfoque en diseño, calidad y detalle.
            </p>
          </div>

          {/* Social */}
          <div>
            <h4 className="type-section-title mb-4 text-center text-zinc-700 md:text-left">
              Síguenos
            </h4>
            <ul className="grid grid-cols-3 gap-3 text-sm md:block md:space-y-3.5">
              {instagramUrl ? (
                <li>
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="footer-link flex flex-col items-center justify-center gap-1 text-center md:flex-row md:items-center md:justify-start md:gap-2 md:text-left"
                  >
                    <InstagramIcon className="h-5 w-5" /> Instagram
                  </a>
                </li>
              ) : null}
              {tiktokUrl ? (
                <li>
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="footer-link flex flex-col items-center justify-center gap-1 text-center md:flex-row md:items-center md:justify-start md:gap-2 md:text-left"
                  >
                    <TikTokIcon className="h-5 w-5" /> TikTok
                  </a>
                </li>
              ) : null}
              {facebookUrl ? (
                <li>
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="footer-link flex flex-col items-center justify-center gap-1 text-center md:flex-row md:items-center md:justify-start md:gap-2 md:text-left"
                  >
                    <FacebookIcon className="h-5 w-5" /> Facebook
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          {/* Contact */}
          <div className="text-center md:text-left">
            <h4 className="type-section-title mb-4 text-zinc-700">
              Contacto
            </h4>
            <ul className="type-body space-y-2 text-zinc-700/90">
              <li>Bogotá, Colombia</li>
              {contactEmail ? (
                <li>
                  <a href={`mailto:${contactEmail}`} className="footer-link">
                    {contactEmail}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-12 border-t border-zinc-900/8 pt-6 md:mt-14 md:pt-7">
          <div className="type-body flex flex-col items-center justify-between gap-4 md:flex-row md:items-end">
            <div className="footer-meta flex flex-col items-center gap-1 md:items-start">
              <span>
                © {new Date().getFullYear()} Kame.col. Todos los derechos reservados.
              </span>
              <span className="type-body footer-meta">
                Desarrollado por{" "}
                <a
                  href={process.env.NEXT_PUBLIC_LINKEDIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="type-action footer-link"
                >
                  Nicolás Gaitán
                </a>
              </span>
            </div>
            <div className="type-ui-label flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-end">
              <Link href="/legal/politica-de-privacidad#terminos" className="footer-link">Términos</Link>
              <Link href="/legal/politica-de-privacidad#privacidad" className="footer-link">Privacidad</Link>
              <Link href="/legal/politica-de-privacidad#cookies" className="footer-link">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}