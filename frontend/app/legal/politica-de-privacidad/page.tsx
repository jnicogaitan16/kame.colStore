import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Términos, Privacidad y Cookies | Kame.col",
  description:
    "Consulta los términos y condiciones, política de privacidad, cookies, pagos, envíos y garantías de Kame.col.",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-end justify-between gap-4">
        <h2 className="type-section-title text-black/72">{title}</h2>
      </div>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-black/12 via-black/6 to-transparent" />
      <div className="mt-5 max-w-none space-y-4">
        <div className="legal-richtext type-body text-black/72">{children}</div>
      </div>
    </section>
  );
}

export default function PoliticaDePrivacidadPage() {
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
            <span className="text-black/44">Políticas</span>
          </p>
          <h1 className="type-page-title mt-3 text-[#111111]">
            Políticas de Kame.col
          </h1>
          <p className="type-body mt-3 max-w-2xl text-black/62">
            Aquí encuentras nuestros{" "}
            <strong className="text-black">Términos y condiciones</strong>,{" "}
            <strong className="text-black">Política de Privacidad</strong> y{" "}
            <strong className="text-black">Política de Cookies</strong>, junto con
            información sobre pagos, envíos y garantías de nuestra tienda virtual.
          </p>
        </div>

        <div className="surface-card-premium mb-10 rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_16px_44px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="type-section-title text-black/68">Accesos rápidos</p>
          <p className="type-body mt-1 text-black/58">
            Salta directo a la sección que necesitas.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-3">
            {[
              { href: "#terminos", label: "Términos" },
              { href: "#pagos", label: "Pagos" },
              { href: "#envios", label: "Envíos" },
              { href: "#garantias", label: "Garantías" },
              { href: "#privacidad", label: "Privacidad" },
              { href: "#cookies", label: "Cookies" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                className="type-action rounded-full border border-black/10 bg-[#fafaf7] px-4 py-2 text-black/74 transition hover:border-black/16 hover:bg-black/[0.03] hover:text-black"
                href={href}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-14 md:space-y-15">
          <Section id="terminos" title="Términos de la tienda virtual">
            <p>
              Al navegar o comprar en Kame.col (en adelante, Kame.col), aceptas
              estas condiciones. Kame.col opera como una{" "}
              <strong>tienda virtual</strong> de ropa y accesorios con piezas
              propias, prendas diseñadas por la marca y algunos productos
              personalizados o hechos bajo pedido.
            </p>

            <h3 className="mt-10">1) Naturaleza de la tienda</h3>
            <p>
              Kame.col no presta atención presencial al público. Toda la atención
              comercial, de soporte y postventa se realiza por nuestros canales
              digitales oficiales.
            </p>

            <h3 className="mt-10">2) Producto, fotografías y referencias</h3>
            <ul>
              <li>
                <strong>Piezas de la marca:</strong> trabajamos con prendas y
                accesorios diseñados por Kame.col. Algunas referencias pueden
                producirse o personalizarse bajo pedido.
              </li>
              <li>
                <strong>Imágenes de catálogo:</strong> las imágenes publicadas son
                de referencia comercial. El producto final puede presentar
                variaciones mínimas en tono, escala, ubicación del diseño o
                apariencia visual debido al proceso de confección, estampado,
                iluminación, pantalla del dispositivo o producción.
              </li>
              <li>
                <strong>Disponibilidad:</strong> el inventario se muestra en
                tiempo real cuando es posible. En casos excepcionales de alta
                demanda, compras simultáneas o fallas de sincronización, podremos
                contactarte para ajustar la cantidad disponible o proponer una
                alternativa.
              </li>
            </ul>

            <h3 className="mt-10">3) Tallas y guía de medidas</h3>
            <ul>
              <li>
                <strong>Revisión previa:</strong> antes de comprar, el cliente
                debe revisar cuidadosamente la guía de medidas publicada en el
                sitio.
              </li>
              <li>
                <strong>Confirmación de talla:</strong> al finalizar la compra,
                entendemos que la talla fue elegida con base en la guía de medidas
                disponible.
              </li>
              <li>
                <strong>Sin cambios por talla:</strong> no realizamos cambios por
                talla, gusto personal, percepción de horma o error del cliente al
                seleccionar la talla.
              </li>
            </ul>

            <h3 className="mt-10">4) Datos del pedido</h3>
            <ul>
              <li>
                <strong>Información correcta:</strong> es responsabilidad del
                cliente ingresar datos reales y completos: nombre, teléfono,
                correo, dirección, ciudad y referencias.
              </li>
              <li>
                <strong>Impacto de errores:</strong> errores u omisiones en la
                información de compra o envío pueden generar retrasos,
                reprogramaciones o costos adicionales.
              </li>
            </ul>

            <h3 id="pagos" className="mt-10">
              5) Precios, pagos y confirmación
            </h3>
            <ul>
              <li>
                <strong>Precios:</strong> todos los precios se muestran en pesos
                colombianos (COP).
              </li>
              <li>
                <strong>Pasarela de pago:</strong> los pagos en línea se procesan
                a través de <strong>Wompi</strong>, pasarela de pagos certificada{" "}
                <strong>PCI DSS</strong> respaldada por el ecosistema Bancolombia.
                Kame.col no almacena ni tiene acceso a los datos de tu tarjeta u
                otro medio de pago.
              </li>
              <li>
                <strong>Medios de pago aceptados:</strong> tarjetas de crédito y
                débito Visa, Mastercard y American Express, PSE, Nequi y Botón
                Bancolombia, según disponibilidad al momento del pago.
              </li>
              <li>
                <strong>Confirmación:</strong> el pedido se considera confirmado
                una vez Wompi reporta el pago como aprobado. Recibirás un correo
                de confirmación con la referencia de tu orden.
              </li>
              <li>
                <strong>Pagos rechazados:</strong> si tu pago es declinado, te
                recomendamos verificar los datos ingresados o contactar a tu
                entidad financiera. Puedes intentar el pago nuevamente desde la
                misma pantalla.
              </li>
              <li>
                <strong>Términos Wompi:</strong> al realizar un pago aceptas
                también los{" "}
                <a
                  href="https://wompi.co/terminos-y-condiciones-usuarios/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="type-action text-black/88 hover:text-black hover:underline"
                >
                  Términos y Condiciones de Wompi
                </a>{" "}
                aplicables al usuario.
              </li>
            </ul>

            <h3 id="envios" className="mt-10">
              6) Producción y envíos
            </h3>
            <ul>
              <li>
                <strong>Producción:</strong> los tiempos de preparación pueden
                variar según el tipo de prenda, personalización, volumen operativo
                y disponibilidad de insumos.
              </li>
              <li>
                <strong>Aliado logístico:</strong> realizamos envíos a todo
                Colombia principalmente por medio de{" "}
                <strong>Servientrega S.A.</strong>.
              </li>
              <li>
                <strong>Dirección y entrega:</strong> el cliente debe ingresar la
                dirección completa, ciudad y referencias. Si la transportadora
                reporta dirección insuficiente, ausencia del destinatario, rechazo
                o datos errados, el reenvío y sus costos podrán ser asumidos por
                el cliente.
              </li>
              <li>
                <strong>Seguimiento:</strong> una vez despachado el pedido,
                compartiremos la guía de envío cuando aplique.
              </li>
              <li>
                <strong>Tiempos logísticos:</strong> los tiempos de entrega pueden
                variar por operación de la transportadora, clima, cierres viales,
                temporada alta o situaciones externas ajenas a Kame.col.
              </li>
            </ul>

            <h3 id="garantias" className="mt-10">
              7) Cambios, devoluciones y garantías
            </h3>
            <ul>
              <li>
                <strong>Sin cambios por talla:</strong> no realizamos cambios por
                talla cuando la guía de medidas fue informada antes de la compra y
                la talla fue elegida por el cliente.
              </li>
              <li>
                <strong>Sin devoluciones voluntarias de dinero:</strong> no
                realizamos devoluciones de dinero por gusto, cambio de opinión,
                error en la talla elegida por el cliente o apreciaciones
                subjetivas sobre color o acabado, sin perjuicio de los derechos
                que puedan aplicar al consumidor según la ley colombiana.
              </li>
              <li>
                <strong>Productos personalizados:</strong> las piezas
                confeccionadas conforme a las especificaciones del cliente o
                claramente personalizadas no admiten retracto por tratarse de
                productos hechos bajo especificación.
              </li>
              <li>
                <strong>Garantía:</strong> atendemos solicitudes por defectos de
                confección, costura o fabricación, o por errores evidentes
                atribuibles al proceso productivo.
              </li>
              <li>
                <strong>Plazo para reportar:</strong> cualquier novedad visible al
                momento de la entrega debe reportarse dentro de las{" "}
                <strong>48 horas</strong> siguientes, adjuntando fotos o video del
                producto, empaque y guía si aplica.
              </li>
              <li>
                <strong>Resultado de la revisión:</strong> una vez validado el
                caso, Kame.col podrá ofrecer reparación, reposición de la pieza o
                la solución que corresponda conforme a la ley aplicable.
              </li>
            </ul>

            <h3 className="mt-10">8) Estampado, uso y cuidado</h3>
            <ul>
              <li>
                <strong>Duración estimada:</strong> la duración del estampado o
                aplicación textil depende del uso, la frecuencia de lavado, la
                forma de secado, el planchado y el cuidado general de la prenda.
              </li>
              <li>
                <strong>Desgaste normal:</strong> no otorgamos garantía por
                desgaste normal del estampado, deterioro por uso, lavado,
                fricción, calor excesivo o manejo inadecuado de la prenda.
              </li>
            </ul>

            <h3 className="mt-10">9) Uso del sitio y propiedad intelectual</h3>
            <p>
              La marca Kame.col, sus diseños, fotografías, piezas gráficas, textos
              y demás contenidos del sitio son propiedad de Kame.col o se usan
              con autorización. No está permitido su uso, reproducción o
              explotación comercial sin autorización previa y expresa.
            </p>

            <h3 className="mt-10">10) Atención al cliente</h3>
            <p>
              Si necesitas soporte sobre tu pedido, envío o garantía, puedes
              escribirnos por nuestros canales oficiales. Atenderemos cada caso
              por orden de llegada y con la información necesaria para su
              validación.
            </p>

            <p className="type-ui-label mt-6 text-black/42">
              Última actualización: {new Date().toLocaleDateString("es-CO")}.
            </p>
          </Section>

          <Section id="privacidad" title="Política de privacidad">
            <p>
              En Kame.col cuidamos tu información personal. Esta política explica
              qué datos recopilamos en nuestra tienda virtual, para qué los usamos
              y cómo los protegemos.
            </p>
            <h3>1) Datos que podemos recopilar</h3>
            <ul>
              <li>Datos de contacto: nombre, correo, teléfono.</li>
              <li>Datos de entrega: dirección y referencias para envío.</li>
              <li>
                Datos del pedido: productos, variantes (talla/color), dirección de
                envío y notas cuando aplique.
              </li>
              <li>
                Datos técnicos básicos: IP, navegador y páginas visitadas (para
                analítica y seguridad).
              </li>
            </ul>
            <h3>2) Para qué usamos tus datos</h3>
            <ul>
              <li>Gestionar pedidos, pagos, producción y entregas.</li>
              <li>
                Responder mensajes y solicitudes por WhatsApp, correo o redes.
              </li>
              <li>
                Mejorar la experiencia del sitio con métricas de rendimiento y
                navegación.
              </li>
              <li>Cumplir obligaciones legales o prevenir fraude.</li>
            </ul>
            <h3>3) Procesamiento de pagos</h3>
            <p>
              Los pagos son procesados por <strong>Wompi</strong> (Pasarela
              Colombia S.A.S., NIT 830006973-1). Kame.col no almacena datos de
              tarjetas ni medios de pago. El tratamiento de datos en el proceso de
              pago está regido por la{" "}
              <a
                href="https://wompi.co/politica-de-privacidad/"
                target="_blank"
                rel="noopener noreferrer"
                className="type-action text-black/88 hover:text-black hover:underline"
              >
                Política de Privacidad de Wompi
              </a>
              .
            </p>
            <h3>4) Protección</h3>
            <p>
              Aplicamos medidas razonables (técnicas y operativas) para evitar
              accesos no autorizados. Aun así, ningún sistema es 100% infalible.
            </p>
            <h3>5) Compartir información</h3>
            <p>
              No vendemos tus datos. Solo podríamos compartirlos con proveedores
              necesarios para operar — transportadoras, pasarela de pagos o
              aliados tecnológicos — y únicamente para gestionar tu pedido o
              soporte.
            </p>
            <h3>6) Derechos</h3>
            <p>
              Puedes solicitar acceso, corrección o eliminación de tus datos
              escribiéndonos a{" "}
              <a
                href="mailto:soporte@kamecol.com"
                className="type-action text-black/88 hover:text-black hover:underline"
              >
                soporte@kamecol.com
              </a>
              . Te responderemos en el menor tiempo posible.
            </p>
          </Section>

          <Section id="cookies" title="Política de cookies">
            <p>
              Usamos cookies y tecnologías similares para que el sitio funcione
              correctamente y para entender cómo se utiliza.
            </p>
            <ul>
              <li>
                <strong>Esenciales:</strong> permiten funciones básicas como
                mantener el carrito de compras activo durante tu sesión.
              </li>
              <li>
                <strong>Analítica:</strong> nos ayudan a mejorar el sitio
                midiendo páginas visitadas y comportamiento de navegación.
              </li>
            </ul>
            <p>
              Puedes bloquear o eliminar cookies desde la configuración de tu
              navegador. Ten en cuenta que algunas funciones podrían dejar de
              funcionar correctamente.
            </p>
          </Section>
        </div>

        <div className="surface-card-premium mt-12 rounded-[1.75rem] border border-black/8 bg-white p-6 shadow-[0_16px_44px_rgba(15,23,42,0.06)] backdrop-blur">
          <h2 className="type-section-title text-black/72">Contacto</h2>
          <p className="type-body mt-2 text-black/62">
            Si tienes preguntas sobre estas políticas, tu pedido, envíos o
            garantías, escríbenos a{" "}
            <a
              className="type-action text-black/88 hover:text-black hover:underline"
              href="mailto:soporte@kamecol.com"
            >
              soporte@kamecol.com
            </a>
            . La atención se realiza únicamente por canales digitales.
          </p>
        </div>
      </div>
    </div>
  );
}