import Image from "next/image";

type Props = {
  show: boolean;
  variant?: "card" | "detail";
  className?: string;
};

export default function SoldOutBadge({ show, variant = "card", className = "" }: Props) {
  if (!show) return null;

  const base =
    variant === "detail"
      ? "absolute top-3 left-3 w-[140px] sm:w-[180px] rotate-[-12deg] opacity-95 z-10"
      : "absolute top-2 left-2 w-[72px] sm:w-[84px] rotate-[-12deg] opacity-95 z-10";

  return (
    <div className={`${base} ${className}`}>
      <Image
        src="/badges/sold-out.png"
        alt="Sold out"
        width={400}
        height={200}
        priority={variant === "detail"}
      />
    </div>
  );
}
