import type { InputHTMLAttributes, ReactNode } from "react";
import { IconCheck } from "./icons";

export function Field({
  id,
  label,
  hint,
  hintClass = "",
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Extra classes for the hint, e.g. to hide it on phones where a shared note replaces it. */
  hintClass?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5 tall:mb-7 max-sm:mb-4" data-field={id}>
      <label htmlFor={id} className="t-label mb-2 block">
        {label}
      </label>
      {children}
      {hint && !error && <p className={`mt-2 text-[14.5px] text-fg-3 tall:text-[16px] ${hintClass}`}>{hint}</p>}
      {error && (
        <p className="mt-2 text-[15px] font-medium text-coral tall:text-[17px]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (invalid: boolean) =>
  `block w-full min-h-15 max-sm:min-h-13 rounded-xl border bg-surface px-4 text-fg outline-none placeholder:text-fg-3 transition-[border-color,box-shadow] duration-150 focus:ring-4 tall:min-h-[72px] ${
    invalid ? "border-coral focus:ring-coral/15" : "border-hair-strong focus:border-mint focus:ring-mint/15"
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

/** Recessed track; the chosen option is filled in brand green. */
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
    <div
      id={id}
      role="radiogroup"
      className={`flex gap-1 rounded-xl border bg-surface-2 p-1 ${invalid ? "border-coral" : "border-hair-strong"}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[52px] flex-1 rounded-lg px-3 text-[17px] font-medium transition-colors duration-150 tall:min-h-16 tall:text-[20px] ${
              on ? "bg-brand text-white shadow-lift" : "text-fg-2 active:bg-surface-3"
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
      className={`mb-3 flex min-h-16 w-full items-start gap-3.5 rounded-xl border px-4 py-4 text-left transition-colors duration-150 tall:px-6 tall:py-5 ${
        checked ? "border-mint bg-mint/[0.06]" : invalid ? "border-coral bg-surface" : "border-hair-strong bg-surface active:bg-surface-2"
      }`}
    >
      <span
        className={`mt-px flex size-7 shrink-0 items-center justify-center rounded-lg border-[1.5px] transition-colors duration-150 tall:size-8 ${
          checked ? "border-mint bg-mint text-white" : invalid ? "border-coral text-transparent" : "border-hair-strong text-transparent"
        }`}
      >
        <IconCheck className="size-[18px]" />
      </span>
      <span className="text-[16px] leading-snug text-fg tall:text-[19px]">{children}</span>
    </button>
  );
}
