import { Fragment, type ReactNode } from "react";

type Seg = { type: "text"; value: string } | { type: "link"; href: string; label: string };

function shortAltshiftLabel(href: string): string {
  try {
    const u = href.startsWith("http") ? new URL(href) : new URL(href, "https://www.altshift.ca");
    if (!/(^|\.)altshift\.ca$/i.test(u.hostname) && href.startsWith("http")) return href;
    const path = `${u.pathname}${u.search}` || "/";
    if (path.startsWith("/dashboard")) return "Dashboard";
    if (path.startsWith("/join-pros")) return "Join Pros";
    if (path.startsWith("/pro-plans")) return "Pro plans";
    if (path.startsWith("/services")) return "Services";
    if (path.startsWith("/auth")) return path.includes("signup") ? "Sign up" : "Log in";
    if (path.startsWith("/support")) return "Support";
    if (path.startsWith("/get-app/ios")) return "iPhone app";
    if (path.startsWith("/get-app/android")) return "Android app";
    if (path.startsWith("/get-app")) return "Get the app";
    const slug = path.replace(/^\//, "").split(/[/?#]/)[0];
    return slug ? slug.replace(/-/g, " ") : "AltShift";
  } catch {
    return href;
  }
}

function parseChatLinks(text: string): Seg[] {
  const segs: Seg[] = [];
  const re =
    /\[([^\]]{1,80})\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|(https?:\/\/(?:www\.)?altshift\.ca[^\s<>"'`\]]*)|(https?:\/\/[^\s<>"'`\]]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] && m[2]) {
      const href = m[2].trim();
      const label =
        href.includes("altshift.ca") || href.startsWith("/")
          ? m[1].trim() || shortAltshiftLabel(href)
          : m[1].trim();
      segs.push({ type: "link", label, href });
    } else if (m[3]) {
      const raw = m[3];
      const href = raw.replace(/[.,;:!?]+$/u, "");
      const trail = raw.slice(href.length);
      segs.push({ type: "link", label: shortAltshiftLabel(href), href });
      if (trail) segs.push({ type: "text", value: trail });
    } else if (m[4]) {
      const raw = m[4];
      const href = raw.replace(/[.,;:!?]+$/u, "");
      const trail = raw.slice(href.length);
      segs.push({ type: "link", label: href, href });
      if (trail) segs.push({ type: "text", value: trail });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ type: "text", value: text.slice(last) });
  return segs.length ? segs : [{ type: "text", value: text }];
}

const inlineLinkClass =
  "font-semibold text-primary underline underline-offset-2 hover:opacity-90 break-words cursor-pointer";

/** Renders assistant chat text with inline clickable <a href> links only (no bare long URLs for AltShift). */
export function ChatMessageContent({
  text,
  className,
  onNavigate,
}: {
  text: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const nodes: ReactNode[] = parseChatLinks(text).map((seg, i) => {
    if (seg.type === "text") return <Fragment key={i}>{seg.value}</Fragment>;
    return (
      <a key={i} href={seg.href} className={inlineLinkClass} onClick={() => onNavigate?.()}>
        {seg.label}
      </a>
    );
  });

  return <span className={`whitespace-pre-wrap ${className ?? ""}`}>{nodes}</span>;
}
