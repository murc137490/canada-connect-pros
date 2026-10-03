import { Coffee, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Cycles light, cream and dark. Default app theme follows the OS (`system`). */
export default function AnimatedThemeToggler({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const buttonClassName = cn(
    "relative h-9 w-9 shrink-0 rounded-lg border border-border bg-background/80 flex items-center justify-center overflow-hidden transition-colors hover:bg-muted/80",
    className
  );

  if (!mounted) {
    return (
      <button
        type="button"
        className={buttonClassName}
        aria-hidden="true"
        tabIndex={-1}
        disabled
      />
    );
  }

  const currentTheme = resolvedTheme ?? "light";
  const nextTheme = currentTheme === "light" ? "cream" : currentTheme === "cream" ? "dark" : "light";
  const ThemeIcon = currentTheme === "dark" ? Moon : currentTheme === "cream" ? Coffee : Sun;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={buttonClassName}
      aria-label={`Current theme: ${currentTheme}. Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <ThemeIcon size={16} className="transition-transform duration-300" aria-hidden="true" />
    </button>
  );
}
