/**
 * Address suggestions for the pro workspace field.
 * Uses Google Places when a browser key is present, then Photon so a list still appears
 * when the Maps key was not baked into the site build.
 */

export type AddressHit = {
  label: string;
  lat: number;
  lng: number;
};

const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as string | undefined;

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
};

function photonLabel(props: PhotonFeature["properties"]): string {
  if (!props) return "";
  const street = [props.housenumber, props.street].filter(Boolean).join(" ");
  const parts = [street || props.name, props.city, props.state, props.postcode, props.country].filter(Boolean);
  return parts.join(", ");
}

async function suggestFromPhoton(query: string): Promise<AddressHit[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en&lat=46.8&lon=-71.2`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const features = data.features ?? [];
  const canadian = features.filter((f) => (f.properties?.countrycode ?? "").toUpperCase() === "CA");
  const list = (canadian.length ? canadian : features).slice(0, 5);
  return list
    .map((f) => {
      const coords = f.geometry?.coordinates;
      const label = photonLabel(f.properties);
      if (!coords || coords.length < 2 || !label) return null;
      return { label, lng: coords[0], lat: coords[1] };
    })
    .filter((row): row is AddressHit => row != null);
}

async function suggestFromGoogle(query: string): Promise<AddressHit[]> {
  if (!GOOGLE_KEY) return [];
  const { whenGoogleMapsReady } = await import("@/lib/loadGoogleMapsJs");
  await whenGoogleMapsReady(GOOGLE_KEY);
  const g = (window as Window & {
    google?: {
      maps?: {
        places?: {
          AutocompleteSuggestion?: {
            fetchAutocompleteSuggestions: (req: object) => Promise<{
              suggestions?: {
                placePrediction?: {
                  text?: { text?: string };
                  toPlace: () => {
                    fetchFields: (opts: { fields: string[] }) => Promise<void>;
                    formattedAddress?: string;
                    location?: { lat: () => number; lng: () => number };
                  };
                };
              }[];
            }>;
          };
        };
      };
    };
  }).google;
  const Suggestion = g?.maps?.places?.AutocompleteSuggestion;
  if (!Suggestion) return [];
  const { suggestions } = await Suggestion.fetchAutocompleteSuggestions({
    input: query,
    includedRegionCodes: ["ca"],
  });
  const hits: AddressHit[] = [];
  for (const row of (suggestions ?? []).slice(0, 5)) {
    const prediction = row.placePrediction;
    if (!prediction) continue;
    const place = prediction.toPlace();
    await place.fetchFields({ fields: ["formattedAddress", "location"] });
    const lat = place.location?.lat();
    const lng = place.location?.lng();
    const label = place.formattedAddress || prediction.text?.text || "";
    if (label && typeof lat === "number" && typeof lng === "number") hits.push({ label, lat, lng });
  }
  return hits;
}

export async function suggestAddresses(query: string): Promise<AddressHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const googleHits = await suggestFromGoogle(q);
    if (googleHits.length) return googleHits;
  } catch {
    /* fall through */
  }
  try {
    return await suggestFromPhoton(q);
  } catch {
    return [];
  }
}

export async function reverseToAddress(lat: number, lng: number): Promise<string | null> {
  try {
    const { reverseGeocode } = await import("@/lib/geocode");
    const addr = await reverseGeocode(lat, lng);
    if (addr?.trim()) return addr.trim();
  } catch {
    /* fall through */
  }
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      postcode?: string;
      countryName?: string;
    };
    const label = [data.locality || data.city, data.principalSubdivision, data.postcode, data.countryName]
      .filter(Boolean)
      .join(", ");
    return label || null;
  } catch {
    return null;
  }
}
