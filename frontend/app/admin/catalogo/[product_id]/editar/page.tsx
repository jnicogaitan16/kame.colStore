import { redirect } from "next/navigation";

/** Compatibilidad: edición bajo /catalogo/productos/[id]/editar */
export default function LegacyCatalogoEditarRedirect({
  params,
}: {
  params: { product_id: string };
}) {
  redirect(`/admin/catalogo/productos/${params.product_id}/editar`);
}
