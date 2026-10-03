import { Coffee, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/** Cycles light, cream and dark. Default app theme follows the OS (`system`). */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const currentTheme = resolvedTheme ?? "light";
  const nextTheme = currentTheme === "light" ? "cream" : currentTheme === "cream" ? "dark" : "light";
  const ThemeIcon = currentTheme === "dark" ? Moon : currentTheme === "cream" ? Coffee : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      className={`h-9 w-9 ${className}`}
      aria-label={`Current theme: ${currentTheme}. Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
    >
      <ThemeIcon size={16} aria-hidden="true" />
      <span className="sr-only">Switch to {nextTheme} theme</span>
    </Button>
  );
}
