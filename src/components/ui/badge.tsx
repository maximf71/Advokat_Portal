import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "green" | "bronze" | "navy" | "muted";
}) {
  const tones = {
    default: "border-rule bg-surface text-ink",
    green: "border-[#1E5631]/30 bg-[#1E5631]/5 text-registry-green",
    bronze: "border-[#8C6D46]/30 bg-[#8C6D46]/10 text-bronze",
    navy: "border-navy/30 bg-navy/5 text-navy",
    muted: "border-rule bg-paper text-muted-ink",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
