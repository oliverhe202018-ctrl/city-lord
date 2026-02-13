import React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "active" | "danger" | "success";
  interactive?: boolean;
}

export function GlassCard({
  children,
  className,
  variant = "default",
  interactive = false,
  ...props
}: GlassCardProps) {
  const baseStyles =
    "relative overflow-hidden rounded-xl border backdrop-blur-md transition-all duration-300";
  
  const variants = {
    default: "bg-card/60 border-border shadow-lg shadow-black/5",
    active: "bg-primary/10 border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.15)]",
    danger: "bg-destructive/10 border-destructive/30 shadow-[0_0_15px_hsl(var(--destructive)/0.15)]",
    success: "bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]",
  };

  const interactiveStyles = interactive
    ? "hover:bg-card/80 hover:border-foreground/20 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
    : "";

  return (
    <div
      className={cn(baseStyles, variants[variant], interactiveStyles, className)}
      {...props}
    >
      {/* Glossy gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
