import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Términos, Privacidad y Cookies | Kame.col",
  description:
    "Consulta los términos y condiciones, política de privacidad, cookies, envíos y devoluciones de Kame.col.",
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
        <h2 className="text-2xl font-semibold tracking-tight text-white/95 md:text-3xl">
          {title}
        </h2>
      </div>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
      <div className="prose prose-invert mt-6 max-w-none prose-p:text-white/80 prose-li:text-white/80 prose-strong:text-white prose-headings:text-white/95 prose-a:text-emerald-300 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-white/15 prose-li:marker:text-white/35">
        {children}
      </div>
    </section>
  );
}

export default function PoliticaDePrivacidadPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <div className="mb-10">
        <p className="text-xs tracking-wide text-neutral-500">
          <Link href="/" className="text-neutral-400 hover:text-white hover:underline">
            Inicio
          </Link>
          <span className="px-2 text-white/20">/</span>
          <span className="text-neutral-500">Legal</span>
          <span className="px-2 text-white/20">/</span>
          <span className="text-neutral-400">Políticas</span>
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Políticas de Kame.col
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
          Aquí encuentras nuestros <strong className="text-white">Términos y condiciones</strong>,{" "}
          <strong className="text-white">Política de Privacidad</strong> y{" "}
          <strong className="text-white">Política de Cookies</strong>.
        </p>
      </div>

      <div className="mb-12 rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-sm backdrop-blur">
        <p className="text-sm font-semibold text-white/90">Accesos rápidos</p>
        <p className="mt-1 text-xs text-white/55">Salta directo a la sección que necesitas.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#terminos"
          >
            Términos
          </Link>
          <Link
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#privacidad"
          >
            Privacidad
          </Link>
          <Link
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-white/25 hover:bg-white/10"
            href="#cookies"
          >
            Cookies
          </Link>
        </div>
      </div>

      <div className="space-y-16">
        <Section id="terminos" title="Términos y condiciones">
          <p>
            Al navegar, registrarte o comprar en Kame.col (en adelante, “Kame.col”), aceptas estos términos y condiciones. Nuestro sitio ofrece
            productos de ropa y accesorios, incluyendo piezas personalizadas que pueden fabricarse bajo pedido.
          </p>

          <h3 className="mt-10">1) Alcance del servicio</h3>
          <p>
            Kame.col comercializa productos propios y/o intervenidos mediante técnicas como sublimación, impresión y personalización. Algunas piezas
            pueden producirse bajo demanda; por ello, los tiempos de preparación pueden variar según el producto y la carga operativa.
          </p>

          <h3 className="mt-10">2) Información del pedido</h3>
          <ul>
            <li>
              <strong>Datos correctos:</strong> es responsabilidad del cliente entregar información veraz y completa (talla, color, referencia, dirección y
              datos de contacto). Errores u omisiones pueden generar retrasos o costos adicionales.
            </li>
            <li>
              <strong>Personalización:</strong> al tratarse de piezas personalizadas, pueden existir variaciones mínimas de tono, escala o encuadre respecto a
              las imágenes de referencia. Esto hace parte del proceso artesanal y de impresión.
            </li>
            <li>
              <strong>Disponibilidad y stock:</strong> el inventario se muestra en tiempo real en la medida de lo posible. En casos excepcionales (alta demanda,
              fallas de sincronización o compras simultáneas), podríamos contactarte para ajustar cantidades o proponer alternativas.
            </li>
          </ul>

          <h3 className="mt-10">3) Precios, pagos y confirmación</h3>
          <ul>
            <li>
              <strong>Precios:</strong> se muestran en COP e incluyen los impuestos aplicables, salvo que se indique lo contrario.
            </li>
            <li>
              <strong>Confirmación del pedido:</strong> el pedido se considera confirmado cuando el pago sea verificado y el estado del pedido cambie a “Pagado”.
            </li>
            <li>
              <strong>Comprobantes:</strong> en caso de transferencia, el cliente puede ser requerido para enviar soporte del pago si el sistema o el banco lo
              solicita.
            </li>
          </ul>

          <h3 className="mt-10">4) Producción y tiempos</h3>
          <p>
            Los tiempos de producción dependen del tipo de producto, su nivel de personalización y la disponibilidad de insumos. Cuando apliquen, te
            informaremos avances y/o novedades por los canales de contacto registrados.
          </p>

          <h3 className="mt-10">5) Política de envíos (Servientrega S.A.)</h3>
          <ul>
            <li>
              <strong>Aliado logístico:</strong> los envíos se realizan principalmente con nuestra empresa aliada <strong>Servientrega S.A.</strong>.
            </li>
            <li>
              <strong>Dirección:</strong> asegúrate de ingresar dirección completa, ciudad y referencias. Si la transportadora reporta dirección insuficiente, el
              envío puede reprogramarse y generar costos adicionales.
            </li>
            <li>
              <strong>Guía y seguimiento:</strong> cuando el pedido sea despachado, compartiremos la guía para seguimiento (si aplica).
            </li>
            <li>
              <strong>Entregas fallidas:</strong> si el paquete retorna por ausencia del destinatario, datos errados o negativa de recepción, podremos reenviar
              previa confirmación y el costo del reenvío será asumido por el cliente.
            </li>
            <li>
              <strong>Riesgos de transporte:</strong> Kame.col acompaña la gestión de novedades con la transportadora. Sin embargo, los tiempos finales pueden
              variar por operación logística, clima, cierres viales o contingencias externas.
            </li>
          </ul>

          <h3 className="mt-10">6) Cambios, devoluciones y garantías</h3>
          <p>
            Por la naturaleza de nuestros productos (en especial los personalizados), aplican condiciones especiales:
          </p>
          <ul>
            <li>
              <strong>Productos personalizados:</strong> no admiten devolución por gusto, talla incorrecta elegida por el cliente o cambios de opinión, ya que son
              piezas únicas fabricadas bajo especificación.
            </li>
            <li>
              <strong>Excepciones:</strong> si el producto llega con defecto de fabricación, impresión notablemente incorrecta respecto a lo aprobado/solicitado,
              o daño atribuible al transporte, podrás reportarlo dentro de las <strong>48 horas</strong> posteriores a la entrega.
            </li>
            <li>
              <strong>Evidencia:</strong> para validar el caso, solicitaremos fotos y/o video del empaque y del producto. Una vez aprobado, gestionaremos
              reposición, ajuste o nota crédito según corresponda.
            </li>
            <li>
              <strong>Medidas y color:</strong> pequeñas variaciones en medidas y tonos pueden ocurrir por procesos textiles y de impresión. Esto no se considera
              defecto cuando se mantiene dentro de rangos razonables del producto.
            </li>
          </ul>

          <h3 className="mt-10">7) Uso del sitio y propiedad intelectual</h3>
          <p>
            Los contenidos del sitio (marca, diseños, textos e imágenes) son propiedad de Kame.col o se usan con autorización. Queda prohibida su
            reproducción o uso comercial sin permiso expreso.
          </p>

          <h3 className="mt-10">8) Atención al cliente</h3>
          <p>
            Si necesitas soporte, cambios de información del pedido o tienes una novedad con tu entrega, escríbenos por nuestros canales oficiales.
            Haremos lo posible por ayudarte de forma prioritaria.
          </p>

          <p className="mt-6 text-xs text-white/50">
            Última actualización: {new Date().toLocaleDateString("es-CO")}.
          </p>
        </Section>

        <Section id="privacidad" title="Política de privacidad">
          <p>
            En Kame.col cuidamos tu información. Esta política explica qué datos recopilamos, para qué los usamos y cómo los protegemos.
          </p>
          <h3>1) Datos que podemos recopilar</h3>
          <ul>
            <li>Datos de contacto: nombre, correo, teléfono.</li>
            <li>Datos de entrega: dirección y referencias para envío.</li>
            <li>Datos del pedido: productos, variantes (talla/color), notas de personalización.</li>
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
            No vendemos tus datos. Solo podríamos compartirlos con proveedores necesarios para operar (por ejemplo, transportadoras o pasarelas de pago)
            y únicamente para completar tu pedido.
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
        <h3 className="text-lg font-semibold text-white/95">Contacto</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Si tienes preguntas sobre estas políticas, escríbenos a{" "}
          <a className="font-medium text-emerald-300 hover:underline" href="mailto:kame.col.023@gmail.com">
            kame.col.023@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}