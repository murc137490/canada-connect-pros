/** Load Maps JavaScript API + Places once (shared across address autocomplete and pro service map). */
export function whenGoogleMapsReady(apiKey: string): Promise<void> {
  const w = window as Window & { google?: { maps?: { places?: unknown; Map?: unknown } } };
  if (w.google?.maps?.Map) return Promise.resolve();

  const findScript = () =>
    Array.from(document.querySelectorAll("script")).find((s) =>
      (s as HTMLScriptElement).src?.includes("maps.googleapis.com/maps/api/js"),
    ) as HTMLScriptElement | undefined;

  const existing = findScript();
  if (existing) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finishOk = () => {
        if (settled) return;
        if (w.google?.maps?.Map) {
          settled = true;
          resolve();
        }
      };
      finishOk();
      queueMicrotask(finishOk);
      setTimeout(finishOk, 50);
      setTimeout(finishOk, 300);
      existing.addEventListener("load", finishOk, { once: true });
      existing.addEventListener(
        "error",
        () => {
          if (!settled) {
            settled = true;
            reject(new Error("Google Maps script error"));
          }
        },
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(script);
  });
}

export function triggerMapResize(map: { setCenter?: (c: { lat: number; lng: number }) => void } | null): void {
  const g = (window as Window & { google?: { maps?: { event?: { trigger: (m: unknown, e: string) => void } } } }).google;
  if (map && g?.maps?.event) {
    try {
      g.maps.event.trigger(map, "resize");
    } catch {
      // ignore
    }
  }
}
