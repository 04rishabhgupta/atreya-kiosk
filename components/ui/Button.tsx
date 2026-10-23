import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-700 disabled:bg-brand/40",
  secondary: "bg-card text-brand border-2 border-brand/25 active:bg-brand-50 disabled:opacity-50",
  ghost: "bg-transparent text-brand active:bg-brand-50 disabled:opacity-50",
  danger: "bg-bad text-white active:opacity-90",
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
      className={`inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl px-6 text-[22px] font-semibold transition-transform duration-100 active:scale-[0.98] disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
