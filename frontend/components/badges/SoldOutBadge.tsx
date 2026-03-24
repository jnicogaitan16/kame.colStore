import Image from "next/image";

type Props = {
  show: boolean;
  variant?: "card" | "detail";
  className?: string;
  label?: string;
};

export default function SoldOutBadge({
  show,
  variant = "card",
  className = "",
  label = "SOLD OUT",
}: Props) {
  if (!show) return null;

  const shellClass =
    variant === "detail"
      ? "inline-flex w-full max-w-[140px] rotate-[-12deg] select-none"
      : "inline-flex w-full max-w-[84px] rotate-[-12deg] select-none";

  return (
    <span
      className={`${shellClass} ${className}`.trim()}
      aria-label={label}
      role="img"
    >
      <Image
        src="/badges/sold-out.png"
        alt={label}
        width={320}
        height={160}
        priority={variant === "detail"}
        className="block w-full h-auto object-contain select-none pointer-events-none"
      />
    </span>
  );
}
