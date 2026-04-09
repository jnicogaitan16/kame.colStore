import { redirect } from "next/navigation";

/** Compatibilidad: la creación de productos vive bajo /catalogo/productos/nuevo */
export default function LegacyCatalogoNuevoRedirect() {
  redirect("/admin/catalogo/productos/nuevo");
}
