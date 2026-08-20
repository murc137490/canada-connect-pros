/** Resolve public Square Web Payments IDs (app + location) for the browser SDK. */

export type SquareWebConfig = {
  applicationId: string;
  locationId: string;
  environment: "sandbox" | "production";
};

const ENV_APP = (import.meta.env.VITE_SQUARE_APPLICATION_ID as string | undefined)?.trim() || "";
const ENV_LOC = (import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined)?.trim() || "";

let cached: SquareWebConfig | null | undefined;
let inflight: Promise<SquareWebConfig | null> | null = null;

function fromEnv(): SquareWebConfig | null {
  if (ENV_APP && ENV_LOC) {
    return {
      applicationId: ENV_APP,
      locationId: ENV_LOC,
      environment: ENV_APP.startsWith("sandbox-") ? "sandbox" : "production",
    };
  }
  return null;
}

/** Prefer Vite env; otherwise fetch from Supabase edge secrets via square-web-config. */
export async function resolveSquareWebConfig(opts?: {
  /** Pro Connect location overrides platform location when present. */
  preferredLocationId?: string | null;
}): Promise<SquareWebConfig | null> {
  const preferred =
    typeof opts?.preferredLocationId === "string" && opts.preferredLocationId.trim()
      ? opts.preferredLocationId.trim()
      : "";

  const env = fromEnv();
  if (env) {
    return preferred ? { ...env, locationId: preferred } : env;
  }

  if (cached !== undefined) {
    if (!cached) return null;
    return preferred ? { ...cached, locationId: preferred } : cached;
  }

  if (!inflight) {
    inflight = (async () => {
      const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!base || !anon) {
        cached = null;
        return null;
      }
      try {
        const res = await fetch(`${base}/functions/v1/square-web-config`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${anon}`,
            apikey: anon,
          },
        });
        const data = (await res.json().catch(() => ({}))) as {
          configured?: boolean;
          application_id?: string | null;
          location_id?: string | null;
          environment?: string;
        };
        const applicationId = typeof data.application_id === "string" ? data.application_id.trim() : "";
        const locationId = typeof data.location_id === "string" ? data.location_id.trim() : "";
        if (!data.configured || !applicationId || !locationId) {
          cached = null;
          return null;
        }
        cached = {
          applicationId,
          locationId,
          environment: data.environment === "production" ? "production" : "sandbox",
        };
        return cached;
      } catch {
        cached = null;
        return null;
      } finally {
        inflight = null;
      }
    })();
  }

  const remote = await inflight;
  if (!remote) return null;
  return preferred ? { ...remote, locationId: preferred } : remote;
}
