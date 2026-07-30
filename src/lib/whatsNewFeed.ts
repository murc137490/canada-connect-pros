export type WhatsNewItem = {
  id: string;
  kind: "booking" | "review" | "platform" | "announcement" | "moderation";
  title: string;
  body?: string;
  href: string;
  createdAt: string;
};

export const WHATS_NEW_CHANGED_EVENT = "premiere-whats-new-changed";

const READ_KEY = "premiere-whats-new-read-v1";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function loadWhatsNewReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markWhatsNewRead(id: string): void {
  const set = loadWhatsNewReadIds();
  set.add(id);
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function markWhatsNewReadMany(ids: string[]): void {
  const set = loadWhatsNewReadIds();
  ids.forEach((id) => set.add(id));
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function isWithinWhatsNewWindow(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < SEVEN_DAYS_MS;
}

/** Items still visible in the menu (7-day window). */
export function filterWhatsNewItemsByAge(items: WhatsNewItem[]): WhatsNewItem[] {
  return items.filter((item) => isWithinWhatsNewWindow(item.createdAt));
}

/** Unread items in the 7-day window (drives the badge count). */
export function filterUnreadWhatsNewItems(items: WhatsNewItem[], readIds: Set<string>): WhatsNewItem[] {
  return items.filter((item) => isWithinWhatsNewWindow(item.createdAt) && !readIds.has(item.id));
}

/** @deprecated Use filterUnreadWhatsNewItems */
export function filterActiveWhatsNewItems(items: WhatsNewItem[], readIds: Set<string>): WhatsNewItem[] {
  return filterUnreadWhatsNewItems(items, readIds);
}

/** Body text for job-request moderation notices in What's new. */
export function formatModerationNoticeBody(notice: {
  body: string;
  rules_reminder: string | null;
  reason: string;
  strike_count: number | null;
}): string {
  if (notice.reason === "redo" || notice.strike_count == null) {
    return notice.body.trim();
  }
  return notice.body.trim();
}

/** Hide one-off platform welcome after the user opens it. */
export function isWhatsNewItemVisible(item: WhatsNewItem, readIds: Set<string>): boolean {
  if (item.id === "platform-welcome" && readIds.has(item.id)) return false;
  return true;
}

export function filterVisibleWhatsNewItems(items: WhatsNewItem[], readIds: Set<string>): WhatsNewItem[] {
  return items.filter((item) => isWhatsNewItemVisible(item, readIds));
}

export function aggregateWhatsNewItems(
  items: WhatsNewItem[],
  labels: { bookingsMany: string; reviewsMany: string },
): WhatsNewItem[] {
  const bookings = items.filter((i) => i.kind === "booking");
  const reviews = items.filter((i) => i.kind === "review");
  const rest = items.filter((i) => i.kind === "platform" || i.kind === "announcement" || i.kind === "moderation");

  const out: WhatsNewItem[] = [...rest];

  if (bookings.length >= 5) {
    out.push({
      id: "agg-bookings",
      kind: "booking",
      title: labels.bookingsMany.replace("{{count}}", String(bookings.length)),
      href: "/dashboard?tab=bookings",
      createdAt: bookings[0]!.createdAt,
    });
  } else {
    out.push(...bookings);
  }

  if (reviews.length >= 5) {
    out.push({
      id: "agg-reviews",
      kind: "review",
      title: labels.reviewsMany.replace("{{count}}", String(reviews.length)),
      href: "/dashboard?tab=reviews",
      createdAt: reviews[0]!.createdAt,
    });
  } else {
    out.push(...reviews);
  }

  return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
