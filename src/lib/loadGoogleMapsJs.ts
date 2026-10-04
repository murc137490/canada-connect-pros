/** Load Maps JavaScript API + Places once (shared across address autocomplete and pro service map). */
type MapsWindow = Window & {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>;
      Map?: unknown;
      places?: unknown;
      event?: { trigger: (m: unknown, e: string) => void };
    };
  };
};

let loading: Promise<void> | null = null;

function mapsWindow(): MapsWindow {
  return window as MapsWindow;
}

async function waitForImportLibrary(): Promise<NonNullable<MapsWindow["google"]>["maps"]> {
  for (let i = 0; i < 30; i++) {
    const maps = mapsWindow().google?.maps;
    if (maps?.importLibrary) return maps;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  throw new Error("Google Maps importLibrary missing");
}

export function whenGoogleMapsReady(apiKey: string): Promise<void> {
  const maps = mapsWindow().google?.maps;
  if (maps?.Map && maps.places) return Promise.resolve();
  if (!apiKey) return Promise.reject(new Error("missing maps key"));
  if (!loading) {
    loading = (async () => {
      const existing = document.querySelector('script[data-altshift-maps="1"]') as HTMLScriptElement | null;
      if (!mapsWindow().google?.maps && !existing) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.dataset.altshiftMaps = "1";
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Google Maps script failed"));
          document.head.appendChild(script);
        });
      }
      const ready = await waitForImportLibrary();
      await ready.importLibrary?.("maps");
      await ready.importLibrary?.("places");
      if (!mapsWindow().google?.maps?.Map) throw new Error("Google Maps unavailable");
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

export function triggerMapResize(map: { setCenter?: (c: { lat: number; lng: number }) => void } | null): void {
  const g = mapsWindow().google;
  if (map && g?.maps?.event) {
    try {
      g.maps.event.trigger(map, "resize");
    } catch {
      // ignore
    }
  }
}
