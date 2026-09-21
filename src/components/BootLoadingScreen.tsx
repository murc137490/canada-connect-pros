import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";

type BootLoadingScreenProps = {
  /** Accessible status label */
  label?: string;
  /** When false, fills parent instead of covering the viewport */
  fullScreen?: boolean;
};

/**
 * Same AltShift long-shadow boot treatment as `index.html` `#altshift-boot`.
 * Use anywhere a spinner would otherwise flash after the HTML splash dismisses.
 */
export default function BootLoadingScreen({
  label = "AltShift",
  fullScreen = true,
}: BootLoadingScreenProps) {
  const [dark, setDark] = useState(() => {
    try {
      const theme = localStorage.getItem("altshift-theme");
      return (
        theme === "dark" ||
        ((theme === "system" || theme === null) &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="altshift-boot-screen"
      data-boot-theme={dark ? "dark" : "light"}
      data-compact={fullScreen ? undefined : "true"}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <main className="altshift-boot-screen__main">
        <div className="altshift-boot-screen__logo flex flex-col items-center gap-4">
          <BrandLogo className={dark ? "h-16 w-16 brightness-0 invert" : "h-16 w-16"} />
          <h1>AltShift</h1>
        </div>
      </main>
    </div>
  );
}
