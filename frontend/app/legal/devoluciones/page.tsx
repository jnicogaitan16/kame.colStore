import Link from "next/link";

export const metadata = {
  title: "Cambios y Devoluciones | Kame.col",
  description:
    "Política de cambios, devoluciones y garantías de Kame.col. Conoce los plazos, condiciones y el proceso para solicitar un cambio o devolución.",
};

export default function DevolucionesPage() {
  const whatsappPhone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "573137008959";
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent("Hola, quiero solicitar un cambio/devolución de mi pedido.")}`;

  return (
    <div className="page-shell page-shell--editorial text-[#111111]">
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-1 md:pb-14 md:pt-1">
        <div className="page-intro mb-8 md:mb-9">
          <p className="type-ui-label text-black/44">
            <Link
              href="/"
              className="type-ui-label text-black/44 transition-colors hover:text-black hover:underline"
            >
              Inicio
            </Link>
            <span className="px-2 text-black/18">/</span>
            <span className="text-black/38">Legal</span>
            <span className="px-2 text-black/18">/</span>
            <span className="text-black/44">Cambios y Devoluciones</span>
          </p>
          <h1 className="type-page-title mt-3 text-[#111111]">
            Cambios y Devoluciones
          </h1>
          <p className="type-body mt-3 max-w-2xl text-black/62">
            En Kame.col queremos que estés satisfecho con tu compra. Aquí te
            explicamos cómo funciona nuestro proceso de cambios y devoluciones.
          </p>
        </div>

        <div className="space-y-10 md:space-y-12">
          <section>
            <h2 className="type-section-title text-black/72">Plazo para solicitar</h2>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-black/12 via-black/6 to-transparent" />
            <div className="mt-5 legal-richtext type-body text-black/72 space-y-4">
              <p>
                Tienes <strong>5 días hábiles</strong> desde la recepción del producto
                para reportar cualquier novedad. Pasado este plazo, no se aceptarán
                solicitudes de cambio o devolución.
              </p>
            </div>
          </section>

          <section>
            <h2 className="type-section-title text-black/72">Condiciones</h2>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-black/12 via-black/6 to-transparent" />
            <div className="mt-5 legal-richtext type-body text-black/72 space-y-4">
              <p>Para que tu solicitud sea válida, el producto debe:</p>
              <ul>
                <li>Estar <strong>sin uso</strong> y en las mismas condiciones en que fue entregado.</li>
                <li>Conservar sus <strong>etiquetas originales</strong> intactas.</li>
                <li>No presentar signos de lavado, uso, alteraciones o daño por parte del cliente.</li>
              </ul>
              <p>
                <strong>No aplican cambios o devoluciones</strong> por:
              </p>
              <ul>
                <li>Talla incorrecta elegida por el cliente (revisa la guía de medidas antes de comprar).</li>
                <li>Cambio de opinión, gusto personal o percepción subjetiva de color.</li>
                <li>Productos personalizados o hechos bajo pedido.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="type-section-title text-black/72">Garantía por defectos</h2>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-black/12 via-black/6 to-transparent" />
            <div className="mt-5 legal-richtext type-body text-black/72 space-y-4">
              <p>
                Si tu producto presenta un <strong>defecto de fabricación</strong>{" "}
                (costura, estampado, material), tienes <strong>48 horas</strong> desde
                la entrega para reportarlo con fotos o video del defecto, el producto
                y el empaque.
              </p>
              <p>
                Una vez validado, Kame.col ofrecerá <strong>reparación o reposición</strong>{" "}
                de la pieza según disponibilidad.
              </p>
            </div>
          </section>

          <section>
            <h2 className="type-section-title text-black/72">Proceso</h2>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-black/12 via-black/6 to-transparent" />
            <div className="mt-5 legal-richtext type-body text-black/72 space-y-4">
              <ol>
                <li>
                  <strong>Escríbenos por WhatsApp</strong> indicando tu número de
                  pedido y el motivo de la solicitud.
                </li>
                <li>
                  <strong>Envía fotos</strong> del producto, etiquetas y empaque.
                </li>
                <li>
                  Nuestro equipo <strong>revisará tu caso</strong> y te responderá
                  en máximo 2 días hábiles.
                </li>
                <li>
                  Si aplica, te indicaremos cómo enviar el producto de vuelta.
                  Los <strong>costos de envío de devolución</strong> corren por cuenta
                  del cliente, excepto en casos de defecto de fabricación.
                </li>
              </ol>
            </div>
          </section>

          <div className="surface-card-premium rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_16px_44px_rgba(15,23,42,0.06)] backdrop-blur">
            <h2 className="type-section-title text-black/72">
              ¿Necesitas hacer un cambio o devolución?
            </h2>
            <p className="type-body mt-2 text-black/62">
              Contáctanos por WhatsApp y te ayudamos con tu solicitud.
            </p>
            <div className="mt-4">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="type-action inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#fafaf7] px-5 py-2.5 text-black/74 transition hover:border-black/16 hover:bg-black/[0.03] hover:text-black"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
