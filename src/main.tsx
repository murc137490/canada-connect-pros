import { silenceClientDiagnostics } from "./lib/silenceClientDiagnostics";
import { SAFE_USER_ERROR, readUiLocale } from "./lib/userFacingError";

silenceClientDiagnostics();

const rootEl = document.getElementById("root");
const showError = (html: string) => {
  if (rootEl) rootEl.innerHTML = html;
};

async function bootstrap() {
  if (!rootEl) {
    document.body.innerHTML =
      '<div style="padding:24px;font-family:sans-serif;text-align:center;">Please refresh. If this continues, contact support@premiereservices.ca.</div>';
    return;
  }
  try {
    const [{ createRoot }, { default: App }, _css] = await Promise.all([
      import("react-dom/client"),
      import("./App.tsx"),
      import("./index.css"),
    ]);
    createRoot(rootEl).render(<App />);
    // Boot splash dismisses when auth finishes (or at 11s max) — see AuthContext + index.html.
  } catch {
    const copy = SAFE_USER_ERROR[readUiLocale()];
    showError(
      `<div style="padding:24px;max-width:440px;margin:40px auto;background:#f8f6f3;border-radius:12px;color:#141A24;font-family:sans-serif;text-align:center;">` +
        `<h2 style="margin:0 0 10px 0;">${copy.title}</h2>` +
        `<p style="margin:0 0 16px 0;color:#5E6672;line-height:1.5;">${copy.description}</p>` +
        `<a href="/support" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#102556;color:#FBF9F6;border-radius:8px;text-decoration:none;font-weight:600;">${copy.supportCta}</a>` +
        `<button onclick="location.reload()" style="padding:10px 16px;background:transparent;color:#102556;border:1px solid #E0DAD2;border-radius:8px;cursor:pointer;font-weight:600;">Refresh</button>` +
        `</div>`,
    );
    try {
      window.dispatchEvent(new Event("premiere-app-ready"));
    } catch {
      /* ignore */
    }
  }
}
bootstrap();
