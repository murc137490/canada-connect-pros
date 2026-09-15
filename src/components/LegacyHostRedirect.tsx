import { useEffect } from "react";
import { CANONICAL_ORIGIN } from "@/components/CanonicalUrl";

const LEGACY_HOSTS = new Set(["premiereservices.ca", "www.premiereservices.ca"]);

/**
 * Hard client-side guard: if the app somehow loads on the old Première domain
 * (cache, misconfigured DNS, etc.), immediately jump to AltShift and keep path/query/hash.
 */
export default function LegacyHostRedirect() {
  useEffect(() => {
    try {
      const host = window.location.hostname.toLowerCase();
      if (!LEGACY_HOSTS.has(host)) return;
      const next = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(next);
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
