import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// =============================================================
// SHADCN/UI UTILITY - cn()
// Merges Tailwind classes safely, resolving conflicts.
// Usage: cn("px-4 py-2", condition && "bg-primary", className)
// =============================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
