import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-tight transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm/80 focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" && "h-11 px-4 text-sm",
        size === "sm" && "h-9 px-3 text-sm",
        size === "icon" && "h-10 w-10",
        variant === "primary" &&
          "bg-warm text-void shadow-[0_0_24px_rgba(196,122,90,0.28)] hover:bg-glow",
        variant === "secondary" &&
          "border border-subtle bg-elevated text-primary hover:border-warm/40 hover:bg-elevated/80",
        variant === "ghost" && "text-muted hover:bg-elevated hover:text-primary",
        variant === "danger" && "bg-danger/15 text-danger hover:bg-danger/25",
        className,
      )}
      {...props}
    />
  );
}
