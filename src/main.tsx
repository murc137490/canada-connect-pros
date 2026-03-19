import React from "react";

const rootEl = document.getElementById("root");
const showError = (html: string) => {
  if (rootEl) rootEl.innerHTML = html;
};

async function bootstrap() {
  if (!rootEl) {
    document.body.innerHTML = '<div style="padding:20px;color:#c00;">Root #root not found.</div>';
    return;
  }
  try {
    const [{ createRoot }, { default: App }, _css] = await Promise.all([
      import("react-dom/client"),
      import("./App.tsx"),
      import("./index.css"),
    ]);
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error("App failed to load:", err);
    showError(
      '<div style="padding:24px;max-width:480px;margin:40px auto;background:#f0f7f4;border-radius:8px;color:#1a1a1a;font-family:sans-serif;">' +
        '<h2 style="margin:0 0 8px 0;">Could not load the app</h2>' +
        '<p style="margin:0 0 16px 0;color:#444;">Open the browser console (F12) to see the error.</p>' +
        '<pre style="background:#fff;padding:12px;border-radius:6px;font-size:12px;overflow:auto;">' +
        (err instanceof Error ? err.message : String(err)) +
        "</pre>" +
        '<button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;background:#007A56;color:white;border:none;border-radius:6px;cursor:pointer;">Refresh</button>' +
        "</div>"
    );
  }
}
bootstrap();
