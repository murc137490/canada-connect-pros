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

let mapsLoading: Promise<void> | null = null;
let placesLoading: Promise<void> | null = null;

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

export function whenGoogleMapsReady(apiKey: string, includePlaces = true): Promise<void> {
  const maps = mapsWindow().google?.maps;
  if (!apiKey) return Promise.reject(new Error("missing maps key"));
  if (!mapsLoading) {
    mapsLoading = (async () => {
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
      if (!mapsWindow().google?.maps?.Map) throw new Error("Google Maps unavailable");
    })().catch((err) => {
      mapsLoading = null;
      throw err;
    });
  }
  if (!includePlaces) return mapsLoading;
  if (maps?.places) return mapsLoading;
  if (!placesLoading) {
    placesLoading = mapsLoading.then(async () => {
      const ready = await waitForImportLibrary();
      await ready.importLibrary?.("places");
      if (!mapsWindow().google?.maps?.places) throw new Error("Google Places library unavailable");
    }).catch((err) => {
      placesLoading = null;
      throw err;
    });
  }
  return placesLoading;
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
