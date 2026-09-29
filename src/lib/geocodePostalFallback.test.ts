import { afterEach, describe, expect, it, vi } from "vitest";

if (typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("geocodePostalToLocation FSA fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadGeocode() {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test");
    return import("./geocode");
  }

  it("keeps the typed LDU after an exact miss and uses the J2G city pin", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/functions/v1/geocode")) {
        return jsonResponse({ error: "not_found", reason: "ldu_unresolved" }, 404);
      }
      if (url.includes("api.zippopotam.us/ca/J2G")) {
        return jsonResponse({
          places: [
            {
              "place name": "Granby Central",
              latitude: "45.4109",
              longitude: "-72.7103",
              state: "Quebec",
              "state abbreviation": "QC",
            },
          ],
        });
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { geocodePostalToLocation } = await loadGeocode();
    const loc = await geocodePostalToLocation("J2G 1A1");

    expect(loc).toMatchObject({
      city: "Granby Central",
      province: "QC",
      postal: "J2G 1A1",
      lat: 45.4109,
      lng: -72.7103,
    });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("zippopotam"))).toBe(true);
  });

  it("does not replace an exact LDU hit with the FSA centroid", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/functions/v1/geocode")) {
        return jsonResponse({
          lat: 45.4001,
          lng: -72.7302,
          city: "Granby",
          province: "QC",
          postal: "J2G 9H7",
          formattedAddress: "Granby, QC J2G 9H7",
        });
      }
      if (url.includes("zippopotam")) {
        throw new Error("FSA fallback must not run when the exact LDU resolves");
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { geocodePostalToLocation } = await loadGeocode();
    const loc = await geocodePostalToLocation("J2G 9H7");

    expect(loc).toMatchObject({ city: "Granby", province: "QC", postal: "J2G 9H7", lat: 45.4001 });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("zippopotam"))).toBe(false);
  });
});
