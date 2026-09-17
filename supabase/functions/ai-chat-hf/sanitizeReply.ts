/** Turn long AltShift URLs into short markdown links; strip signup prompts when logged in. */
export function sanitizeSupportReply(text: string, loggedIn: boolean): string {
  let out = (text || "").trim();
  if (!out) return out;

  if (loggedIn) {
    out = out.replace(/do you already have an altshift account\??\s*/gi, "");
    out = out.replace(/avez-vous déjà un compte altshift\??\s*/gi, "");
    out = out.replace(/if not,?\s*please sign up[\s\S]*?(?=\n\n|$)/gi, "");
    out = out.replace(/great!\s*first,?\s*please log in[\s\S]*?(?=\n\n|$)/gi, "");
    out = out.replace(/once logged in,?\s*/gi, "");
    out = out.replace(/\[Sign up\]\([^)]+\)/gi, "");
    out = out.replace(/\[Log in\]\([^)]+\)/gi, "");
    out = out.replace(/\[Créer un compte\]\([^)]+\)/gi, "");
    out = out.replace(/\[Se connecter\]\([^)]+\)/gi, "");
    out = out.replace(/https?:\/\/(?:www\.)?altshift\.ca\/auth[^\s)\]]*/gi, "");
  }

  // [Label](https://www.altshift.ca/path) -> [Label](/path)
  out = out.replace(
    /\[([^\]]+)\]\(https?:\/\/(?:www\.)?altshift\.ca(\/[^)\s]*)\)/gi,
    "[$1]($2)",
  );

  // Bare https://www.altshift.ca/foo -> [short](/foo)
  out = out.replace(/https?:\/\/(?:www\.)?altshift\.ca(\/[^\s)\]"'<>]*)/gi, (_m, path: string) => {
    const label = shortPathLabel(path);
    return `[${label}](${path})`;
  });

  // Collapse leftover blank lines
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

function shortPathLabel(path: string): string {
  if (path.startsWith("/dashboard")) return "Dashboard";
  if (path.startsWith("/join-pros")) return "Join Pros";
  if (path.startsWith("/pro-plans")) return "Pro plans";
  if (path.startsWith("/services")) return "Services";
  if (path.startsWith("/support")) return "Support";
  if (path.startsWith("/auth")) return path.includes("signup") ? "Sign up" : "Log in";
  const slug = path.replace(/^\//, "").split(/[/?#]/)[0];
  return slug ? slug.replace(/-/g, " ") : "AltShift";
}
