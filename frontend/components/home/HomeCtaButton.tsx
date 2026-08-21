import type { ReactNode } from "react";

type HomeCtaButtonVariant = "overlay" | "light";

type HomeCtaButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: HomeCtaButtonVariant;
};

export default function HomeCtaButton({
  children,
  className = "",
  variant = "overlay",
}: HomeCtaButtonProps) {
  const variantClass =
    variant === "light" ? "home-cta-sweep--light" : "home-cta-sweep--overlay";

  return (
    <span className={`home-cta-sweep ${variantClass} ${className}`.trim()}>
      <span className="home-cta-sweep__label">{children}</span>
    </span>
  );
}
