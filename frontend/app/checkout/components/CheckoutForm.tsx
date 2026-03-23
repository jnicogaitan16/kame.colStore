"use client";

import type {
  FieldErrors,
  SubmitErrorHandler,
  SubmitHandler,
  UseFormHandleSubmit,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/Button";
import FieldError from "@/components/forms/FieldError";
import Notice from "@/components/ui/Notice";

type CheckoutFormValuesShape = {
  full_name: string;
  email: string;
  phone: string;
  document_type: "CC" | "NIT";
  cedula: string;
  city_code: string;
  address: string;
  notes?: string;
};

type City = { code: string; label: string };

type SubmitNotice = {
  variant: "warning" | "error";
  tone?: "soft" | "strong";
  title: string;
  message: string;
};

type CheckoutFormProps = {
  register: UseFormRegister<CheckoutFormValuesShape>;
  handleSubmit: UseFormHandleSubmit<CheckoutFormValuesShape>;
  errors: FieldErrors<CheckoutFormValuesShape>;
  submitAttempted: boolean;
  fieldErrorId: (name: keyof CheckoutFormValuesShape) => string;
  cities: City[];
  setValue: UseFormSetValue<CheckoutFormValuesShape>;
  onSubmit: SubmitHandler<CheckoutFormValuesShape>;
  onInvalid: SubmitErrorHandler<CheckoutFormValuesShape>;
  isSubmitting: boolean;
  hasBlockingWarnings: boolean;
  stockValidateStatus: "idle" | "checking" | "ok" | "error";
  submitNotice: SubmitNotice | null;
};

function formatCoPhoneDisplay(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");
  const normalized = digits.length >= 10 ? digits.slice(-10) : digits;

  const a = normalized.slice(0, 3);
  const b = normalized.slice(3, 6);
  const c = normalized.slice(6, 10);

  if (!b) return a;
  if (!c) return `${a} ${b}`;
  return `${a} ${b} ${c}`;
}

function fieldWrapperClass() {
  return "space-y-1.5";
}

function fieldLabelClass() {
  return "type-ui-label block text-zinc-700";
}

function fieldControlClass(hasError: boolean, extra?: string) {
  return (
    "field-control h-12 w-full rounded-2xl border bg-white px-4 py-3 text-[16px] text-zinc-950 placeholder:text-zinc-400 outline-none transition shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus:border-zinc-900/18 focus:ring-2 focus:ring-zinc-900/8 md:text-[16px] " +
    (hasError
      ? "border-rose-400/70 ring-rose-400/15 focus:border-rose-500/70 focus:ring-rose-500/15 "
      : "border-zinc-900/10 ") +
    (extra || "")
  ).trim();
}

function fieldTextareaClass(hasError: boolean, extra?: string) {
  return (
    "field-textarea min-h-[112px] w-full resize-none rounded-2xl border bg-white px-4 py-3 text-[16px] text-zinc-950 placeholder:text-zinc-400 outline-none transition shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus:border-zinc-900/18 focus:ring-2 focus:ring-zinc-900/8 md:text-[16px] " +
    (hasError
      ? "border-rose-400/70 ring-rose-400/15 focus:border-rose-500/70 focus:ring-rose-500/15 "
      : "border-zinc-900/10 ") +
    (extra || "")
  ).trim();
}

function fieldAddonShellClass(hasError: boolean) {
  return (
    "field-control flex h-12 rounded-2xl border bg-white text-zinc-950 transition shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus-within:border-zinc-900/18 focus-within:ring-2 focus-within:ring-zinc-900/8 " +
    (hasError
      ? "border-rose-400/70 ring-rose-400/15 focus-within:border-rose-500/70 focus-within:ring-rose-500/15"
      : "border-zinc-900/10")
  ).trim();
}

function fieldAddonClass() {
  return "field-addon flex items-center gap-1 rounded-l-2xl border-r border-zinc-900/8 bg-zinc-50 px-4 text-zinc-700";
}

function fieldAddonInputClass() {
  return "h-full w-full rounded-r-2xl border-0 bg-transparent px-4 text-[16px] text-zinc-950 placeholder:text-zinc-400 outline-none md:text-[16px]";
}

export default function CheckoutForm({
  register,
  handleSubmit,
  errors,
  submitAttempted,
  fieldErrorId,
  cities,
  setValue,
  onSubmit,
  onInvalid,
  isSubmitting,
  hasBlockingWarnings,
  stockValidateStatus,
  submitNotice,
}: CheckoutFormProps) {
  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <div>
        <h2 className="type-section-title mb-3 text-zinc-600">Datos de contacto</h2>

        <div className="space-y-4">
          <div data-field-wrapper="full_name" className={fieldWrapperClass()}>
            <label className={fieldLabelClass()}>Nombre completo</label>
            <input
              type="text"
              id="full_name"
              data-field="full_name"
              {...register("full_name")}
              className={fieldControlClass(!!(submitAttempted && errors.full_name))}
              aria-invalid={submitAttempted && errors.full_name ? true : undefined}
              aria-describedby={errors.full_name ? fieldErrorId("full_name") : undefined}
            />
            <FieldError
              id={fieldErrorId("full_name")}
              message={errors.full_name?.message as string}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div data-field-wrapper="email" className={fieldWrapperClass()}>
              <label className={fieldLabelClass()}>Email</label>
              <input
                type="email"
                id="email"
                data-field="email"
                placeholder="correo@ejemplo.com"
                {...register("email")}
                className={fieldControlClass(!!(submitAttempted && errors.email))}
                aria-invalid={submitAttempted && errors.email ? true : undefined}
                aria-describedby={errors.email ? fieldErrorId("email") : undefined}
              />
              <FieldError
                id={fieldErrorId("email")}
                message={errors.email?.message as string}
              />
            </div>

            <div data-field-wrapper="phone" className={fieldWrapperClass()}>
              <label className={fieldLabelClass()}>Teléfono</label>

              <div
                className={fieldAddonShellClass(!!(submitAttempted && errors.phone))}
              >
                <div className={fieldAddonClass()}>
                  <span aria-hidden>🇨🇴</span>
                  <span className="type-ui-label text-zinc-700">+57</span>
                </div>

                <input
                  type="tel"
                  id="phone"
                  data-field="phone"
                  {...register("phone", {
                    onChange: (e) => {
                      const next = formatCoPhoneDisplay(e.target.value);
                      setValue("phone", next, {
                        shouldDirty: true,
                        shouldValidate: submitAttempted,
                      });
                    },
                  })}
                  placeholder="310 000 0000"
                  inputMode="numeric"
                  autoComplete="tel"
                  className={fieldAddonInputClass()}
                  aria-invalid={submitAttempted && errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? fieldErrorId("phone") : undefined}
                />
              </div>

              <FieldError
                id={fieldErrorId("phone")}
                message={errors.phone?.message as string}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div data-field-wrapper="document_type" className={fieldWrapperClass()}>
              <label className={fieldLabelClass()}>Tipo de documento</label>
              <select
                id="document_type"
                data-field="document_type"
                {...register("document_type")}
                className={fieldControlClass(!!(submitAttempted && errors.document_type))}
                aria-invalid={submitAttempted && errors.document_type ? true : undefined}
                aria-describedby={
                  errors.document_type ? fieldErrorId("document_type") : undefined
                }
              >
                <option value="CC">CC</option>
                <option value="NIT">NIT</option>
              </select>
              <FieldError
                id={fieldErrorId("document_type")}
                message={errors.document_type?.message as string}
              />
            </div>

            <div className="md:col-span-2" data-field-wrapper="cedula">
              <div className={fieldWrapperClass()}>
                <label className={fieldLabelClass()}>Número de documento</label>
                <input
                  type="tel"
                  id="cedula"
                  data-field="cedula"
                  {...register("cedula", {
                    onChange: (e) => {
                      const raw = String(e.target.value ?? "");
                      const digitsOnly = raw.replace(/\D/g, "");
                      setValue("cedula", digitsOnly, {
                        shouldDirty: true,
                        shouldValidate: submitAttempted,
                      });
                    },
                  })}
                  placeholder="12345678"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  className={fieldControlClass(!!(submitAttempted && errors.cedula))}
                  aria-invalid={submitAttempted && errors.cedula ? true : undefined}
                  aria-describedby={errors.cedula ? fieldErrorId("cedula") : undefined}
                />
                <FieldError
                  id={fieldErrorId("cedula")}
                  message={errors.cedula?.message as string}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="type-section-title mb-3 text-zinc-600">Envío</h2>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div data-field-wrapper="city_code" className={fieldWrapperClass()}>
              <label className={fieldLabelClass()}>Ciudad</label>
              <select
                id="city_code"
                data-field="city_code"
                {...register("city_code")}
                className={fieldControlClass(!!(submitAttempted && errors.city_code))}
                aria-invalid={submitAttempted && errors.city_code ? true : undefined}
                aria-describedby={errors.city_code ? fieldErrorId("city_code") : undefined}
              >
                <option value="">Selecciona una ciudad</option>
                {cities.map((city) => (
                  <option key={city.code} value={city.code}>
                    {city.label}
                  </option>
                ))}
              </select>
              <FieldError
                id={fieldErrorId("city_code")}
                message={errors.city_code?.message as string}
              />
            </div>

            <div data-field-wrapper="address" className={fieldWrapperClass()}>
              <label className={fieldLabelClass()}>Dirección</label>
              <input
                type="text"
                id="address"
                data-field="address"
                {...register("address")}
                placeholder="Calle 123 #45-67"
                className={fieldControlClass(!!(submitAttempted && errors.address))}
                aria-invalid={submitAttempted && errors.address ? true : undefined}
                aria-describedby={errors.address ? fieldErrorId("address") : undefined}
              />
              <FieldError
                id={fieldErrorId("address")}
                message={errors.address?.message as string}
              />
            </div>
          </div>

          <div data-field-wrapper="notes" className={fieldWrapperClass()}>
            <label className={fieldLabelClass()}>
              Indicaciones para el envío (opcional)
            </label>
            <textarea
              rows={3}
              id="notes"
              data-field="notes"
              {...register("notes")}
              placeholder="Apartamento, portería, referencias..."
              className={fieldTextareaClass(!!(submitAttempted && errors.notes))}
              aria-invalid={submitAttempted && errors.notes ? true : undefined}
              aria-describedby={errors.notes ? fieldErrorId("notes") : undefined}
            />
            <FieldError
              id={fieldErrorId("notes")}
              message={errors.notes?.message as string}
            />
          </div>
        </div>
      </div>

      {submitNotice ? (
        <Notice
          variant={submitNotice.variant}
          tone={submitNotice.tone}
          title={submitNotice.title}
        >
          {submitNotice.message}
        </Notice>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        className="rounded-xl"
        disabled={isSubmitting || stockValidateStatus === "checking" || hasBlockingWarnings}
      >
        {isSubmitting ? "Procesando pedido..." : "Confirmar pedido"}
      </Button>
    </form>
  );
}
