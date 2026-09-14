import { LabelHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface FormFieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  label: string;
  children: ReactNode;
}

export function FormField({ label, children, className, ...rest }: FormFieldProps) {
  return (
    <label className={clsx("block mb-4", className)} {...rest}>
      <span className="block text-xs font-medium text-ink-soft mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClasses =
  "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors";
