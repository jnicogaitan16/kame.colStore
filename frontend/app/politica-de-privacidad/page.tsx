import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Políticas | Kame.col",
  description: "Términos, privacidad y cookies de Kame.col",
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="prose prose-neutral mt-4 max-w-none prose-a:text-blue-600">
        {children}
      </div>
    </section>
  );
}

export default function PoliticaDePrivacidadPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm text-neutral-500">
          <Link href="/" className="hover:underline">Inicio</Link> / Legal / Políticas
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Políticas de Kame.col</h1>
        <p className="mt-2 text-neutral-600">
          Aquí encuentras nuestros <strong>Términos</strong>, <strong>Política de Privacidad</strong> y <strong>Política de Cookies</strong>.
        </p>
      </div>

      <div className="mb-10 rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-neutral-800">Accesos rápidos</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50" href="#terminos">Términos</Link>
          <Link className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50" href="#privacidad">Privacidad</Link>
          <Link className="rounded-full border px-4 py-2 text-sm hover:bg-neutral-50" href="#cookies">Cookies</Link>
        </div>
      </div>

      <div className="space-y-12">
        <Section id="terminos" title="Términos y condiciones">
          <p>
            Al navegar o comprar en Kame.col, aceptas estos términos. Nuestro sitio ofrece productos personalizados (camisetas, hoodies, mugs y otros)
            que pueden fabricarse bajo pedido.
          </p>
          <ul>
            <li><strong>Pedidos:</strong> la información que nos entregas (talla, color, diseño, referencias) debe ser correcta para evitar reprocesos.</li>
            <li><strong>Personalización:</strong> por tratarse de piezas personalizadas, pueden existir variaciones mínimas de tono o encuadre.</li>
            <li><strong>Pagos y confirmación:</strong> el pedido se considera confirmado cuando el pago sea verificado.</li>
            <li><strong>Envíos:</strong> los tiempos dependen del destino y transportadora. Te compartiremos guía cuando aplique.</li>
            <li><strong>Soporte:</strong> si algo no sale bien, contáctanos y lo resolvemos contigo de forma prioritaria.</li>
          </ul>
          <p className="text-sm text-neutral-500">
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

      <div className="mt-12 rounded-xl border bg-neutral-50 p-5">
        <h3 className="text-lg font-semibold">Contacto</h3>
        <p className="mt-2 text-neutral-700">
          Si tienes preguntas sobre estas políticas, escríbenos a <a href="mailto:kame.col.023@gmail.com">kame.col.023@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}