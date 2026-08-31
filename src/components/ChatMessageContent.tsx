import { Fragment, type ReactNode } from "react";

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

/** Renders assistant chat text with inline clickable <a href> links only (no buttons). */
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
