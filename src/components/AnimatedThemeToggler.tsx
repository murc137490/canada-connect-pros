import { Coffee, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { applySiteTheme, cycleSiteTheme, getActiveSiteTheme, type SiteTheme } from "@/lib/siteTheme";

/** Cycles light, cream and dark. Default app theme follows the OS (`system`). */
export default function AnimatedThemeToggler({ className = "" }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
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

  const contextTheme = theme === "system" ? resolvedTheme : theme;
  const fallbackTheme: SiteTheme = contextTheme === "dark" || contextTheme === "cream" ? contextTheme : "light";
  const currentTheme = getActiveSiteTheme(fallbackTheme);
  const nextTheme = cycleSiteTheme(currentTheme);
  const ThemeIcon = currentTheme === "dark" ? Moon : currentTheme === "cream" ? Coffee : Sun;

  return (
    <button
      type="button"
      onClick={() => applySiteTheme(nextTheme, setTheme)}
      className={buttonClassName}
      aria-label={`Current theme: ${currentTheme}. Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <ThemeIcon size={16} className="transition-transform duration-300" aria-hidden="true" />
    </button>
  );
}
