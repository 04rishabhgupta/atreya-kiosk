import type { InputHTMLAttributes, ReactNode } from "react";
import { IconCheck } from "./icons";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5" data-field={id}>
      <label htmlFor={id} className="mb-1.5 block font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[18px] text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-[18px] font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (invalid: boolean) =>
  `block w-full min-h-16 rounded-2xl border-2 bg-card px-4 text-ink outline-none focus:border-brand ${
    invalid ? "border-bad bg-bad-50" : "border-line"
  }`;

/** Text input with kiosk-friendly defaults: no autocorrect, autocapitalise or autofill. */
export function TextInput({ invalid = false, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      aria-invalid={invalid || undefined}
      className={`${inputClass(invalid)} ${className}`}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  id,
  value,
  options,
  onChange,
  invalid = false,
}: {
  id: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  invalid?: boolean;
}) {
  return (
    <div id={id} role="radiogroup" className="flex gap-3">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-16 flex-1 rounded-2xl border-2 px-3 text-[22px] font-semibold transition-colors duration-100 ${
              on ? "border-brand bg-brand text-white" : invalid ? "border-bad bg-bad-50 text-ink" : "border-line bg-card text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  invalid = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  invalid?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`mb-3 flex min-h-16 w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-colors duration-100 ${
        checked ? "border-brand bg-brand-50" : invalid ? "border-bad bg-bad-50" : "border-line bg-card"
      }`}
    >
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border-2 ${
          checked ? "border-brand bg-brand text-white" : "border-muted/60 bg-card text-transparent"
        }`}
      >
        <IconCheck className="size-6" />
      </span>
      <span className="text-[20px]">{children}</span>
    </button>
  );
}
