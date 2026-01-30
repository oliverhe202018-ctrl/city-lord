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
    default: "bg-white/5 border-white/10 shadow-lg shadow-black/20",
    active: "bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]",
    danger: "bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
    success: "bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]",
  };

  const interactiveStyles = interactive
    ? "hover:bg-white/10 hover:border-white/20 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
    : "";

  return (
    <div
      className={cn(baseStyles, variants[variant], interactiveStyles, className)}
      {...props}
    >
      {/* Glossy gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
