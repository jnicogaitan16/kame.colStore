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
    <footer className="border-t border-zinc-900/8 bg-stone-50 text-zinc-700">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4 items-start">
          {/* Brand */}
          <div className="md:col-span-2 text-center md:text-left">
            <h3 className="type-brand mb-3 text-zinc-950">Kame.col</h3>
            <p className="type-body mx-auto max-w-md md:mx-0">
              Arte urbano y diseño con identidad. Camisetas, hoodies y piezas personalizadas hechas con calidad, detalle y actitud.
            </p>
          </div>

          {/* Social */}
          <div>
            <h4 className="type-section-title mb-4 text-zinc-700 text-center md:text-left">
              Síguenos
            </h4>
            <ul className="grid grid-cols-3 gap-3 text-sm md:block md:space-y-3">
              {instagramUrl ? (
                <li>
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center gap-1 text-center text-zinc-600 transition-colors duration-200 hover:text-zinc-950 md:flex-row md:items-center md:justify-start md:gap-2 md:text-left"
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
                    className="flex flex-col items-center justify-center gap-1 text-center text-zinc-600 transition-colors duration-200 hover:text-zinc-950 md:flex-row md:items-center md:justify-start md:gap-2 md:text-left"
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
                    className="flex flex-col items-center justify-center gap-1 text-center text-zinc-600 transition-colors duration-200 hover:text-zinc-950 md:flex-row md:items-center md:justify-start md:gap-2 md:text-left"
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
            <ul className="space-y-2 type-body">
              <li>Bogotá, Colombia</li>
              {contactEmail ? (
                <li>
                  <a href={`mailto:${contactEmail}`} className="text-zinc-700 transition-colors duration-200 hover:text-zinc-950">
                    {contactEmail}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-12 border-t border-zinc-900/8 pt-6">
          <div className="flex flex-col items-center justify-between gap-4 type-body md:flex-row">
            <div className="flex flex-col items-center gap-1 md:items-start">
              <span>
                © {new Date().getFullYear()} Kame.col. Todos los derechos reservados.
              </span>
              <span className="type-body">
                Desarrollado por{" "}
                <a
                  href={process.env.NEXT_PUBLIC_LINKEDIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="type-action text-zinc-600 transition-colors duration-200 hover:text-zinc-950"
                >
                  Nicolás Gaitán
                </a>
              </span>
            </div>
            <div className="flex gap-4 type-ui-label">
              <Link href="/legal/politica-de-privacidad#terminos" className="text-zinc-600 transition-colors duration-200 hover:text-zinc-950">Términos</Link>
              <Link href="/legal/politica-de-privacidad#privacidad" className="text-zinc-600 transition-colors duration-200 hover:text-zinc-950">Privacidad</Link>
              <Link href="/legal/politica-de-privacidad#cookies" className="text-zinc-600 transition-colors duration-200 hover:text-zinc-950">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}