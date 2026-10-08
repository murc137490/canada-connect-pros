import { isDemoProProfile } from "@/lib/demoAccount";

/** Known junk / QA business names that should not appear in public lists. */
const JUNK_BUSINESS_NAMES = new Set(
  ["john", "dasdsadasd", "test", "testing", "asdf", "asdfasdf"].map((s) => s.toLowerCase()),
);

/**
 * Pros that may appear in public listings / Better Match.
 * Requires verified status and excludes demo/showcase + obvious test names.
 * Does not delete data — filter only.
 */
export function isPubliclyListablePro(pro: {
  business_name?: string | null;
  phone?: string | null;
  is_demo?: boolean | null;
  is_verified?: boolean | null;
} | null | undefined): boolean {
  if (!pro) return false;
  if (pro.is_verified !== true) return false;
  if (isDemoProProfile(pro)) return false;
  const name = (pro.business_name ?? "").trim().toLowerCase();
  if (!name) return false;
  if (JUNK_BUSINESS_NAMES.has(name)) return false;
  // Keyboard-mash / very short junk (keep real short brands like "TV Fix" via length>=3 + letters)
  if (name.length < 3) return false;
  if (/^(.)\1{4,}$/.test(name)) return false; // aaaaa
  if (/^[a-z]{10,}$/i.test(name) && !/\s/.test(name) && !/[aeiou].*[aeiou].*[aeiou]/i.test(name)) {
    // long single-token with few vowels → likely mash (dasdsadasd)
    const vowels = (name.match(/[aeiou]/gi) ?? []).length;
    if (vowels <= 2) return false;
  }
  return true;
}
