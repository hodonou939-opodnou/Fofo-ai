import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "@/components/ui/spinner";

export type ButtonVariant = "primary" | "ghost" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gold text-night font-semibold shadow-[0_10px_30px_-12px_rgb(201_162_75/0.7)] hover:brightness-110 active:brightness-95",
  ghost: "border border-ember text-ivory hover:border-gold/60 hover:text-gold-light",
  subtle: "bg-soot-raised text-ivory hover:bg-ember",
  danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm gap-1.5",
  md: "min-h-11 px-5 text-sm gap-2",
  lg: "min-h-13 px-7 text-base gap-2.5",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return [
    "inline-flex items-center justify-center rounded-full whitespace-nowrap transition",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    loading?: boolean;
  };

type LinkProps = CommonProps & {
  href: string;
  prefetch?: boolean;
  "aria-label"?: string;
  target?: string;
  rel?: string;
};

export default function Button(props: ButtonProps | LinkProps) {
  if (props.href !== undefined) {
    const { href, variant, size, className, children, ...rest } = props;
    return (
      <Link href={href} className={buttonClasses(variant, size, className)} {...rest}>
        {children}
      </Link>
    );
  }
  const { variant, size, className, children, loading, disabled, type, ...rest } = props;
  return (
    <button
      type={type ?? "button"}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
