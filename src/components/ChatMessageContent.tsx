import { Fragment, type ReactNode } from "react";

export type ChatLink = { label: string; href: string };

/** Prefer markdown [label](url), then bare https URLs. */
export function extractChatLinks(text: string): ChatLink[] {
  const links: ChatLink[] = [];
  const seen = new Set<string>();
  const re = /\[([^\]]{1,80})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"'`\]]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const href = (m[2] || m[3] || "").replace(/[.,;:!?]+$/u, "");
    const label = (m[1] || href).trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    links.push({ label, href });
  }
  return links;
}

/** Replace markdown links with just the label for cleaner body text. */
export function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]{1,80})\]\((https?:\/\/[^\s)]+)\)/gi, "$1");
}

type Seg = { type: "text"; value: string } | { type: "link"; href: string; label: string };

function parseChatLinks(text: string): Seg[] {
  const segs: Seg[] = [];
  const re = /\[([^\]]{1,80})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"'`\]]+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] && m[2]) {
      segs.push({ type: "link", label: m[1].trim(), href: m[2] });
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

const inlineLinkClass =
  "font-semibold text-primary underline underline-offset-2 hover:opacity-90 break-words cursor-pointer";

const ctaClass =
  "inline-flex items-center justify-center rounded-full border border-primary/40 bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90";

/**
 * Renders assistant chat text with real <a href> links (full URLs — reliable redirects)
 * plus optional large CTA buttons under the message.
 */
export function ChatMessageContent({
  text,
  className,
  showCtas = true,
  onNavigate,
}: {
  text: string;
  className?: string;
  showCtas?: boolean;
  onNavigate?: () => void;
}) {
  const links = extractChatLinks(text);
  const segs = parseChatLinks(text);
  const nodes: ReactNode[] = segs.map((seg, i) => {
    if (seg.type === "text") return <Fragment key={i}>{seg.value}</Fragment>;
    return (
      <a
        key={i}
        href={seg.href}
        className={inlineLinkClass}
        onClick={() => onNavigate?.()}
      >
        {seg.label}
      </a>
    );
  });

  return (
    <span className={className}>
      <span className="whitespace-pre-wrap">{nodes}</span>
      {showCtas && links.length > 0 ? (
        <span className="mt-2.5 flex flex-wrap gap-2">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={ctaClass} onClick={() => onNavigate?.()}>
              {l.label}
            </a>
          ))}
        </span>
      ) : null}
    </span>
  );
}
