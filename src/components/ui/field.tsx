import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/client/cn";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-primary">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-subtle bg-void px-3 text-sm text-primary placeholder:text-muted/70 transition-colors duration-200 ease-out focus:border-warm/60 focus:outline-none focus:ring-2 focus:ring-warm/30",
        className,
      )}
      {...props}
    />
  );
}
