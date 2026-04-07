"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authLogin, authVerifyOtp, authMe } from "@/lib/admin-api";

// ── Step 1: username + password ───────────────────────────────────────────

function PasswordStep({
  onSuccess,
  onRequiresOtp,
}: {
  onSuccess: () => void;
  onRequiresOtp: (token: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authLogin(username, password);

      if ("requires_otp" in res && res.requires_otp) {
        onRequiresOtp(res.ephemeral_token);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-white/50 mb-1.5" htmlFor="username">
          Usuario
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={INPUT_CLS}
          placeholder="admin"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1.5" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLS}
          placeholder="••••••••"
          required
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <button type="submit" disabled={loading} className={BTN_CLS}>
        {loading ? "Verificando..." : "Continuar"}
      </button>
    </form>
  );
}

// ── Step 2: OTP code ──────────────────────────────────────────────────────

function OtpStep({
  ephemeralToken,
  onSuccess,
  onBack,
}: {
  ephemeralToken: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) return;
    setError("");
    setLoading(true);

    try {
      await authVerifyOtp(ephemeralToken, code);
      onSuccess();
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Código incorrecto.");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-white/60 text-sm">
          Ingresa el código de tu app autenticadora.
        </p>
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1.5" htmlFor="otp">
          Código de verificación
        </label>
        <input
          ref={inputRef}
          id="otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={`${INPUT_CLS} text-center text-2xl tracking-[0.5em] font-mono`}
          placeholder="••••••"
          required
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <button
        type="submit"
        disabled={loading || code.length < 6}
        className={BTN_CLS}
      >
        {loading ? "Verificando..." : "Verificar"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-1"
      >
        ← Volver
      </button>
    </form>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // "credentials" | "otp"
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [ephemeralToken, setEphemeralToken] = useState("");

  useEffect(() => {
    authMe().then((u) => {
      if (u) router.replace("/admin/dashboard");
    });
  }, [router]);

  function handleSuccess() {
    const next = searchParams.get("next") || "/admin/dashboard";
    router.replace(next);
  }

  function handleRequiresOtp(token: string) {
    setEphemeralToken(token);
    setStep("otp");
  }

  function handleBack() {
    setEphemeralToken("");
    setStep("credentials");
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <span className="font-bold text-2xl tracking-tight">
            <span className="text-[#e63946]">kame</span>.col
          </span>
          <p className="text-white/40 text-sm mt-1">
            {step === "otp" ? "Verificación en dos pasos" : "Panel administrativo"}
          </p>
        </div>

        {/* Step indicator */}
        {step === "otp" && (
          <div className="flex items-center gap-2 mb-6">
            <StepDot done label="1" />
            <div className="flex-1 h-px bg-[#e63946]/40" />
            <StepDot active label="2" />
          </div>
        )}

        {step === "credentials" ? (
          <PasswordStep
            onSuccess={handleSuccess}
            onRequiresOtp={handleRequiresOtp}
          />
        ) : (
          <OtpStep
            ephemeralToken={ephemeralToken}
            onSuccess={handleSuccess}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function StepDot({ label, active, done }: { label: string; active?: boolean; done?: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
        done
          ? "bg-[#e63946] text-white"
          : active
          ? "bg-[#e63946] text-white"
          : "bg-white/10 text-white/40"
      }`}
    >
      {done ? "✓" : label}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="text-[#e63946] text-xs bg-[#e63946]/10 border border-[#e63946]/20 rounded px-3 py-2">
      {message}
    </p>
  );
}

const INPUT_CLS =
  "w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#e63946]/50 focus:ring-1 focus:ring-[#e63946]/20";

const BTN_CLS =
  "w-full bg-[#e63946] hover:bg-[#e63946]/90 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-md transition-colors";

// ── Page export ───────────────────────────────────────────────────────────

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
