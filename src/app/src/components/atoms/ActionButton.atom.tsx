import { DotsLoader } from "@koko420/react-components";
import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "ghost" | "danger" | "purple" | "gold-outline";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-grimoire-gold to-grimoire-gold/80 border border-grimoire-gold-bright text-grimoire-bg font-fantasy font-bold hover:from-grimoire-gold-bright hover:to-grimoire-gold hover:shadow-[0_0_20px_rgba(201,162,39,0.4)]",
  accent:
    "bg-gradient-to-b from-grimoire-accent to-grimoire-accent/80 border border-grimoire-accent-bright text-white font-fantasy font-semibold hover:from-grimoire-accent-bright hover:to-grimoire-accent hover:shadow-[0_0_20px_rgba(106,150,215,0.4)]",
  ghost:
    "bg-black/30 border border-grimoire-border text-grimoire-text-dim font-fantasy font-semibold hover:text-grimoire-text hover:bg-black/40",
  danger:
    "bg-grimoire-red/80 border border-grimoire-red text-white font-fantasy font-semibold hover:bg-grimoire-red",
  purple:
    "bg-grimoire-purple/20 border border-grimoire-purple/50 text-grimoire-purple-bright font-fantasy font-semibold hover:bg-grimoire-purple/30",
  "gold-outline":
    "bg-grimoire-gold/20 border border-grimoire-gold text-grimoire-gold font-fantasy font-semibold hover:bg-grimoire-gold/30",
};

export function ActionButton({
  variant = "accent",
  isLoading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ActionButtonProps) {
  const baseClasses =
    "flex items-center justify-center gap-2 px-4 py-2 rounded transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <DotsLoader
          size="xs"
          modifier={variant === "ghost" ? "secondary" : "primary"}
          className="[&>div]:!bg-current"
        />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

