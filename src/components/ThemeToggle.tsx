import { Coffee, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { applySiteTheme, cycleSiteTheme, getActiveSiteTheme, type SiteTheme } from "@/lib/siteTheme";

/** Cycles light, cream and dark. Default app theme follows the OS (`system`). */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const contextTheme = theme === "system" ? resolvedTheme : theme;
  const fallbackTheme: SiteTheme = contextTheme === "dark" || contextTheme === "cream" ? contextTheme : "light";
  const currentTheme = getActiveSiteTheme(fallbackTheme);
  const nextTheme = cycleSiteTheme(currentTheme);
  const ThemeIcon = currentTheme === "dark" ? Moon : currentTheme === "cream" ? Coffee : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => applySiteTheme(nextTheme, setTheme)}
      className={`h-9 w-9 ${className}`}
      aria-label={`Current theme: ${currentTheme}. Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <ThemeIcon size={16} aria-hidden="true" />
      <span className="sr-only">Switch to {nextTheme} theme</span>
    </Button>
  );
}
