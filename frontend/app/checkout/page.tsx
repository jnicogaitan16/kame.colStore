import Link from "next/link";

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-slate-800">Checkout</h1>
      <p className="mt-4 text-slate-600">
        El checkout con React Hook Form + Zod se implementará en el siguiente paso.
        Por ahora puedes seguir comprando y revisar el carrito.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2 font-medium text-white hover:bg-brand-700"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
