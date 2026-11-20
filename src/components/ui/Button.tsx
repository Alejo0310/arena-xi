"use client";

import { forwardRef } from "react";
import { play } from "@/lib/sound";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-neon text-ink hover:bg-white shadow-[0_0_0_1px_rgb(61_255_139/0.4),0_10px_30px_-10px_rgb(61_255_139/0.7)] hover:shadow-[0_0_0_1px_white,0_10px_40px_-8px_rgb(61_255_139/0.9)]",
  secondary: "bg-steel/70 text-white border border-line hover:border-neon/50 hover:bg-steel",
  ghost: "text-soft hover:text-white hover:bg-white/5",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger hover:text-white",
  gold: "bg-gold text-ink hover:bg-white shadow-[0_10px_30px_-10px_rgb(255_210_61/0.8)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.95rem] gap-2",
  lg: "h-14 px-7 text-lg gap-2.5",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      onClick={(e) => {
        play("click");
        onClick?.(e);
      }}
      className={`relative inline-flex select-none items-center justify-center rounded-lg font-display font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
});
