import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-lift active:bg-brand-700 disabled:bg-surface-3 disabled:text-fg-3 disabled:shadow-none",
  secondary: "border border-hair-strong bg-surface text-fg shadow-card active:bg-surface-2 disabled:opacity-50",
  ghost: "text-fg-2 active:bg-surface-2 disabled:opacity-50",
  danger: "bg-coral text-white shadow-lift active:opacity-90",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-16 min-w-16 items-center justify-center gap-2.5 rounded-xl px-6 text-[18px] font-semibold transition-colors duration-150 tall:min-h-[72px] tall:min-w-[72px] tall:text-[20px] ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
