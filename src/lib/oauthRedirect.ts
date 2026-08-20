const REDIRECT_KEY = "premiere:oauth-redirect";

export function peekOAuthRedirect(fallback = "/"): string {
  try {
    const stored = sessionStorage.getItem(REDIRECT_KEY);
    if (stored?.startsWith("/")) return stored;
  } catch {
    /* ignore */
  }
  return fallback.startsWith("/") ? fallback : "/";
}

export function stashOAuthRedirect(path: string) {
  try {
    sessionStorage.setItem(REDIRECT_KEY, path.startsWith("/") ? path : "/");
  } catch {
    /* ignore */
  }
}

export function clearOAuthRedirect() {
  try {
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    /* ignore */
  }
}
