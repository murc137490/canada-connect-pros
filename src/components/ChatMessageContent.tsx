import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Seg =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

const SITE_HOSTS = new Set(["www.premiereservices.ca", "premiereservices.ca"]);

/** Split text into plain runs and markdown / bare URL links. */
export function parseChatLinks(text: string): Seg[] {
  const segs: Seg[] = [];
  // Prefer markdown [label](url), then bare https URLs.
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>"'`\]]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] && m[2]) {
      segs.push({ type: "link", label: m[1], href: m[2] });
    } else if (m[3]) {
      const raw = m[3];
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

function internalPath(href: string): string | null {
  try {
    const u = new URL(href);
    if (!SITE_HOSTS.has(u.hostname.toLowerCase())) return null;
    return `${u.pathname}${u.search}${u.hash}` || "/";
  } catch {
    return null;
  }
}

const linkClass =
  "font-semibold text-primary underline underline-offset-2 hover:opacity-90 break-words";

/**
 * Renders assistant chat text with clickable links:
 * - Markdown: [Sign up](https://www.premiereservices.ca/...)
 * - Bare https URLs
 * Same-site links use in-app navigation.
 */
export function ChatMessageContent({ text, className }: { text: string; className?: string }) {
  const segs = parseChatLinks(text);
  const nodes: ReactNode[] = segs.map((seg, i) => {
    if (seg.type === "text") return <Fragment key={i}>{seg.value}</Fragment>;
    const path = internalPath(seg.href);
    if (path) {
      return (
        <Link key={i} to={path} className={linkClass}>
          {seg.label}
        </Link>
      );
    }
    return (
      <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {seg.label}
      </a>
    );
  });

  return <span className={className}>{nodes}</span>;
}
