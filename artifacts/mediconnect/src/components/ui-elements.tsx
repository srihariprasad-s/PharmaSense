import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { Link } from "wouter";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion } from "framer-motion";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({ 
  children, 
  variant = "primary", 
  size = "md", 
  className, 
  isLoading,
  ...props 
}: ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}) {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-95 focus:ring-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 focus:ring-secondary",
    outline: "border-2 border-border bg-transparent hover:bg-secondary text-foreground active:scale-95 focus:ring-primary",
    ghost: "bg-transparent hover:bg-secondary/50 text-foreground active:scale-95",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20 active:scale-95 focus:ring-destructive",
  };

  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-base",
    lg: "h-14 px-8 text-lg",
  };

  return (
    <button 
      className={cn(baseStyles, variants[variant], sizes[size], className)} 
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : null}
      {children}
    </button>
  );
}

export function Input({ className, label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-foreground/80 ml-1">{label}</label>}
      <input 
        className={cn(
          "flex h-12 w-full rounded-xl border border-border bg-secondary text-foreground px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all duration-200",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-destructive ml-1">{error}</span>}
    </div>
  );
}

export function Card({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn(
      "bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden",
      hover && "transition-all duration-300 hover:shadow-soft hover:border-primary/20 hover:-translate-y-1",
      className
    )}>
      {children}
    </div>
  );
}

export function Badge({ children, variant = "default", className }: { children: ReactNode; variant?: "default" | "success" | "warning" | "error" | "outline"; className?: string }) {
  const variants = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600",
    warning: "bg-yellow-500/10 text-yellow-600",
    error: "bg-destructive/10 text-destructive",
    outline: "border border-border text-muted-foreground",
  };
  
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
