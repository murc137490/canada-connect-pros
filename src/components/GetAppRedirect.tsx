import { Navigate, useLocation } from "react-router-dom";

/** /get-app → the right install guide: iPhone/iPad → iOS, everything else (Android, desktop) → Android guide (which has an iPhone/Android switcher). */
export function detectAppPlatform(ua: string, maxTouchPoints = 0): "ios" | "android" {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS reports as Macintosh with touch support
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  return "android";
}

export default function GetAppRedirect() {
  const location = useLocation();
  const platform =
    typeof navigator === "undefined" ? "android" : detectAppPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  return <Navigate to={`/get-app/${platform}${location.search}`} replace />;
}
