import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "hexagon";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  children: React.ReactNode;
}

export function CyberButton({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}: CyberButtonProps) {
  const baseStyles =
    "relative inline-flex items-center justify-center font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-95 focus:outline-none";

  const variants = {
    primary:
      "bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] border border-cyan-400/50 clip-path-cyber",
    secondary:
      "bg-white/5 text-white border border-white/20 hover:bg-white/10 hover:border-white/40 backdrop-blur-sm",
    ghost: "bg-transparent text-white/60 hover:text-white hover:bg-white/5",
    danger:
      "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-400/50",
    hexagon:
      "bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)] border border-purple-400/50 clip-path-hex",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs rounded-md",
    md: "h-10 px-4 text-sm rounded-lg",
    lg: "h-14 px-8 text-base rounded-xl",
    icon: "h-10 w-10 p-0 rounded-lg",
  };

  // Special handling for rounded corners vs clip-path
  const roundedStyles = (variant === "primary" || variant === "hexagon") ? "" : sizes[size];
  const primarySizeStyles = (variant === "primary" || variant === "hexagon") ? sizes[size].replace("rounded-", "") : ""; // Remove rounded for clipped buttons if we were to implement clip-path fully, but for now let's stick to rounded for simplicity unless it's a specific style. 
  
  // Actually, for "design system", let's keep it consistent. 
  // If the user wants "Cyberpunk", sharp edges or slight rounding is good.
  // Let's stick to standard rounded corners for consistency unless specified.
  
  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
      
      {/* Glitch effect overlay for primary buttons could go here */}
    </button>
  );
}
