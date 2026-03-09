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
        <h2 className="type-section-title text-white/95">
          {title}
        </h2>
      </div>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
      <div className="mt-6 max-w-none space-y-4">
        <div className="legal-richtext type-body text-white/78">
          {children}
        </div>
      </div>
    </section>
  );
}

export default function PoliticaDePrivacidadPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <div className="mb-10">
        <p className="type-ui-label text-neutral-500">
          <Link href="/" className="type-ui-label text-neutral-400 hover:text-white hover:underline">
            Inicio
          </Link>
          <span className="px-2 text-white/20">/</span>
          <span className="text-neutral-500">Legal</span>
          <span className="px-2 text-white/20">/</span>
          <span className="text-neutral-400">Políticas</span>
        </p>
        <h1 className="type-page-title mt-3 text-white">
          Políticas de Kame.col
        </h1>
        <p className="type-body mt-3 max-w-2xl text-white/70">
          Aquí encuentras nuestros <strong className="text-white">Términos y condiciones</strong>,{" "}
          <strong className="text-white">Política de Privacidad</strong> y{" "}
          <strong className="text-white">Política de Cookies</strong>, junto con información sobre pagos, envíos y garantías de nuestra tienda virtual.
        </p>
      </div>

      <div className="mb-12 rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-sm backdrop-blur">
        <p className="type-section-title text-white/90">Accesos rápidos</p>
        <p className="type-body mt-1 text-white/55">Salta directo a la sección que necesitas.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="type-action rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#terminos"
          >
            Términos
          </Link>
          <Link
            className="type-action rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#pagos"
          >
            Pagos
          </Link>
          <Link
            className="type-action rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#envios"
          >
            Envíos
          </Link>
          <Link
            className="type-action rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#garantias"
          >
            Garantías
          </Link>
          <Link
            className="type-action rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#privacidad"
          >
            Privacidad
          </Link>
          <Link
            className="type-action rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#cookies"
          >
            Cookies
          </Link>
        </div>
      </div>

      <div className="space-y-16">
        <Section id="terminos" title="Términos de la tienda virtual">
          <p>
            Al navegar o comprar en Kame.col (en adelante, “Kame.col”), aceptas estas condiciones. Kame.col opera como una <strong>tienda virtual</strong> de ropa y accesorios con piezas propias, prendas diseñadas por la marca y algunos productos personalizados o hechos bajo pedido.
          </p>

          <h3 className="mt-10">1) Naturaleza de la tienda</h3>
          <p>
            Kame.col no presta atención presencial al público. Toda la atención comercial, de soporte y postventa se realiza por nuestros canales digitales oficiales.
          </p>

          <h3 className="mt-10">2) Producto, fotografías y referencias</h3>
          <ul>
            <li>
              <strong>Piezas de la marca:</strong> trabajamos con prendas y accesorios diseñados por Kame.col. Algunas referencias pueden producirse o personalizarse bajo pedido.
            </li>
            <li>
              <strong>Imágenes de catálogo:</strong> las imágenes publicadas son de referencia comercial. El producto final puede presentar variaciones mínimas en tono, escala, ubicación del diseño o apariencia visual debido al proceso de confección, estampado, iluminación, pantalla del dispositivo o producción.
            </li>
            <li>
              <strong>Disponibilidad:</strong> el inventario se muestra en tiempo real cuando es posible. En casos excepcionales de alta demanda, compras simultáneas o fallas de sincronización, podremos contactarte para ajustar la cantidad disponible o proponer una alternativa.
            </li>
          </ul>

          <h3 className="mt-10">3) Tallas y guía de medidas</h3>
          <ul>
            <li>
              <strong>Revisión previa:</strong> antes de comprar, el cliente debe revisar cuidadosamente la guía de medidas publicada en el sitio.
            </li>
            <li>
              <strong>Confirmación de talla:</strong> al finalizar la compra, entendemos que la talla fue elegida con base en la guía de medidas disponible.
            </li>
            <li>
              <strong>Sin cambios por talla:</strong> no realizamos cambios por talla, gusto personal, percepción de horma o error del cliente al seleccionar la talla.
            </li>
          </ul>

          <h3 className="mt-10">4) Datos del pedido</h3>
          <ul>
            <li>
              <strong>Información correcta:</strong> es responsabilidad del cliente ingresar datos reales y completos: nombre, teléfono, correo, dirección, ciudad, referencias y datos del producto solicitado.
            </li>
            <li>
              <strong>Impacto de errores:</strong> errores u omisiones en la información de compra o envío pueden generar retrasos, reprogramaciones o costos adicionales.
            </li>
          </ul>

          <h3 id="pagos" className="mt-10">5) Precios, pagos y confirmación</h3>
          <ul>
            <li>
              <strong>Precios:</strong> todos los precios se muestran en pesos colombianos (COP).
            </li>
            <li>
              <strong>Medio de pago actual:</strong> actualmente procesamos pagos por <strong>transferencia</strong>. Por ahora no contamos con integración a pasarelas de pago tradicionales dentro del sitio.
            </li>
            <li>
              <strong>Validación:</strong> el pedido solo se considera confirmado cuando el pago sea verificado por Kame.col.
            </li>
            <li>
              <strong>Soporte del pago:</strong> podremos solicitar comprobante de transferencia cuando sea necesario para validar el pedido.
            </li>
            <li>
              <strong>Novedades bancarias:</strong> si el cliente presenta inconvenientes al momento de pagar, debe contactar primero a su entidad financiera. La llave o datos habilitados para la transferencia estarán disponibles durante el proceso de compra.
            </li>
          </ul>

          <h3 id="envios" className="mt-10">6) Producción y envíos</h3>
          <ul>
            <li>
              <strong>Producción:</strong> los tiempos de preparación pueden variar según el tipo de prenda, personalización, volumen operativo y disponibilidad de insumos.
            </li>
            <li>
              <strong>Aliado logístico:</strong> realizamos envíos a todo Colombia principalmente por medio de <strong>Servientrega S.A.</strong>.
            </li>
            <li>
              <strong>Dirección y entrega:</strong> el cliente debe ingresar la dirección completa, ciudad y referencias. Si la transportadora reporta dirección insuficiente, ausencia del destinatario, rechazo o datos errados, el reenvío y sus costos podrán ser asumidos por el cliente.
            </li>
            <li>
              <strong>Seguimiento:</strong> una vez despachado el pedido, compartiremos la guía de envío cuando aplique.
            </li>
            <li>
              <strong>Tiempos logísticos:</strong> los tiempos de entrega pueden variar por operación de la transportadora, clima, cierres viales, temporada alta o situaciones externas ajenas a Kame.col.
            </li>
          </ul>

          <h3 id="garantias" className="mt-10">7) Cambios, devoluciones y garantías</h3>
          <ul>
            <li>
              <strong>Sin cambios por talla:</strong> no realizamos cambios por talla cuando la guía de medidas fue informada antes de la compra y la talla fue elegida por el cliente.
            </li>
            <li>
              <strong>Sin devoluciones voluntarias de dinero:</strong> no realizamos devoluciones de dinero por gusto, cambio de opinión, error en la talla elegida por el cliente o apreciaciones subjetivas sobre color o acabado, sin perjuicio de los derechos que puedan aplicar al consumidor según la ley colombiana.
            </li>
            <li>
              <strong>Productos personalizados:</strong> las piezas confeccionadas conforme a las especificaciones del cliente o claramente personalizadas no admiten retracto por tratarse de productos hechos bajo especificación.
            </li>
            <li>
              <strong>Garantía:</strong> atendemos solicitudes por defectos de confección, costura o fabricación, o por errores evidentes atribuibles al proceso productivo.
            </li>
            <li>
              <strong>Plazo para reportar:</strong> cualquier novedad visible al momento de la entrega debe reportarse dentro de las <strong>48 horas</strong> siguientes, adjuntando fotos o video del producto, empaque y guía si aplica.
            </li>
            <li>
              <strong>Resultado de la revisión:</strong> una vez validado el caso, Kame.col podrá ofrecer reparación, reposición de la pieza o la solución que corresponda conforme a la ley aplicable.
            </li>
          </ul>

          <h3 className="mt-10">8) Estampado, uso y cuidado</h3>
          <ul>
            <li>
              <strong>Duración estimada:</strong> la duración del estampado o aplicación textil depende del uso, la frecuencia de lavado, la forma de secado, el planchado y el cuidado general de la prenda.
            </li>
            <li>
              <strong>Desgaste normal:</strong> no otorgamos garantía por desgaste normal del estampado, deterioro por uso, lavado, fricción, calor excesivo o manejo inadecuado de la prenda.
            </li>
          </ul>

          <h3 className="mt-10">9) Uso del sitio y propiedad intelectual</h3>
          <p>
            La marca Kame.col, sus diseños, fotografías, piezas gráficas, textos y demás contenidos del sitio son propiedad de Kame.col o se usan con autorización. No está permitido su uso, reproducción o explotación comercial sin autorización previa y expresa.
          </p>

          <h3 className="mt-10">10) Atención al cliente</h3>
          <p>
            Si necesitas soporte sobre tu pedido, envío o garantía, puedes escribirnos por nuestros canales oficiales. Atenderemos cada caso por orden de llegada y con la información necesaria para su validación.
          </p>

          <p className="type-ui-label mt-6 text-white/50">
            Última actualización: {new Date().toLocaleDateString("es-CO")}.
          </p>
        </Section>

        <Section id="privacidad" title="Política de privacidad">
          <p>
            En Kame.col cuidamos tu información personal. Esta política explica qué datos recopilamos en nuestra tienda virtual, para qué los usamos y cómo los protegemos.
          </p>
          <h3>1) Datos que podemos recopilar</h3>
          <ul>
            <li>Datos de contacto: nombre, correo, teléfono.</li>
            <li>Datos de entrega: dirección y referencias para envío.</li>
            <li>Datos del pedido: productos, variantes (talla/color), dirección de envío, notas de personalización y soporte de pago cuando aplique.</li>
            <li>Datos técnicos básicos: IP, navegador, páginas visitadas (para analítica y seguridad).</li>
          </ul>
          <h3>2) Para qué usamos tus datos</h3>
          <ul>
            <li>Gestionar pedidos, pagos, producción y entregas.</li>
            <li>Responder mensajes y solicitudes (WhatsApp, correo o redes).</li>
            <li>Mejorar la experiencia del sitio con métricas (por ejemplo, rendimiento y navegación).</li>
            <li>Cumplir obligaciones legales o prevenir fraude.</li>
          </ul>
          <h3>3) Protección</h3>
          <p>
            Aplicamos medidas razonables (técnicas y operativas) para evitar accesos no autorizados. Aun así, ningún sistema es 100% infalible.
          </p>
          <h3>4) Compartir información</h3>
          <p>
            No vendemos tus datos. Solo podríamos compartirlos con proveedores necesarios para operar, por ejemplo transportadoras o aliados tecnológicos, y únicamente para gestionar tu pedido, comunicaciones o soporte.
          </p>
          <h3>5) Derechos</h3>
          <p>
            Puedes solicitar acceso, corrección o eliminación de tus datos escribiéndonos. Te responderemos en el menor tiempo posible.
          </p>
        </Section>

        <Section id="cookies" title="Política de cookies">
          <p>
            Usamos cookies y tecnologías similares para que el sitio funcione correctamente y para entender cómo se utiliza.
          </p>
          <ul>
            <li><strong>Esenciales:</strong> permiten funciones básicas (por ejemplo, mantener el carrito).</li>
            <li><strong>Analítica:</strong> nos ayudan a mejorar (por ejemplo, páginas más visitadas).</li>
          </ul>
          <p>
            Puedes bloquear cookies desde tu navegador. Ten en cuenta que algunas funciones podrían dejar de funcionar.
          </p>
        </Section>
      </div>

      <div className="mt-14 rounded-2xl border border-white/10 bg-neutral-900/60 p-6 shadow-sm backdrop-blur">
        <h2 className="type-section-title text-white/95">Contacto</h2>
        <p className="type-body mt-2 text-white/70">
          Si tienes preguntas sobre estas políticas, tu pedido, envíos o garantías, escríbenos a{" "}
          <a className="type-action text-emerald-300 hover:underline" href="mailto:kame.col.023@gmail.com">
            kame.col.023@gmail.com
          </a>
          . La atención se realiza únicamente por canales digitales.
        </p>
      </div>
      <style jsx>{`
        .legal-richtext :global(h3) {
          margin-top: 2.5rem;
          font: var(--type-section-title);
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: -0.02em;
        }

        .legal-richtext :global(p),
        .legal-richtext :global(ul),
        .legal-richtext :global(ol),
        .legal-richtext :global(li) {
          font: var(--type-body);
          color: rgba(255, 255, 255, 0.78);
        }

        .legal-richtext :global(ul),
        .legal-richtext :global(ol) {
          margin: 1rem 0 0;
          padding-left: 1.25rem;
        }

        .legal-richtext :global(li + li) {
          margin-top: 0.75rem;
        }

        .legal-richtext :global(strong) {
          color: rgba(255, 255, 255, 0.96);
        }
      `}</style>
    </div>
  );
}