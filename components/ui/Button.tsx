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
      className={`inline-flex min-h-14 min-w-14 items-center justify-center gap-2.5 rounded-xl px-5 text-[17px] font-semibold max-sm:gap-2 max-sm:px-3 transition-colors duration-150 sm:min-h-16 sm:min-w-16 sm:px-6 sm:text-[18px] tall:min-h-[72px] tall:min-w-[72px] tall:text-[20px] compact:min-h-12 compact:min-w-12 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
