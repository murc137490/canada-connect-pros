import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  aggregateWhatsNewItems,
  filterUnreadWhatsNewItems,
  filterWhatsNewItemsByAge,
  filterVisibleWhatsNewItems,
  loadWhatsNewReadIds,
  markWhatsNewRead,
  markWhatsNewReadMany,
  type WhatsNewItem,
} from "@/lib/whatsNewFeed";
import { markJobModerationNoticeRead } from "@/lib/fetchJobRequestModerationNotices";
import { cn } from "@/lib/utils";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useWhatsNew } from "@/contexts/WhatsNewContext";
import WhatsNewAdminPanel from "@/components/WhatsNewAdminPanel";

type Props = {
  items: WhatsNewItem[];
  variant?: "desktop" | "mobileMenu";
  className?: string;
};

function markAllFeedItemsRead(items: WhatsNewItem[]) {
  const ids = items.map((i) => i.id);
  markWhatsNewReadMany(ids);
  items
    .filter((i) => i.kind === "moderation" && i.id.startsWith("moderation-"))
    .forEach((i) => {
      void markJobModerationNoticeRead(i.id.replace(/^moderation-/, ""));
    });
}

export default function WhatsNewMenu({ items, variant = "desktop", className }: Props) {
  const { t } = useLanguage();
  const { refresh } = useWhatsNew();
  const { isPlatformAdmin, ready: adminReady } = usePlatformAdmin();
  const [open, setOpen] = useState(false);
  const [readTick, setReadTick] = useState(0);
  const showAdminPanel = adminReady && isPlatformAdmin;

  const aggregateLabels = useMemo(
    () => ({
      bookingsMany: t.dashboard.whatsNewBookingsMany ?? "You have {{count}}+ new bookings",
      reviewsMany: t.dashboard.whatsNewReviewsMany ?? "You have {{count}}+ reviews to view",
    }),
    [t.dashboard.whatsNewBookingsMany, t.dashboard.whatsNewReviewsMany],
  );

  const displayItems = useMemo(() => {
    void readTick;
    const readIds = loadWhatsNewReadIds();
    const recent = filterVisibleWhatsNewItems(filterWhatsNewItemsByAge(items), readIds);
    return aggregateWhatsNewItems(recent, aggregateLabels);
  }, [items, readTick, aggregateLabels]);

  const unreadCount = useMemo(() => {
    void readTick;
    const readIds = loadWhatsNewReadIds();
    const unread = filterUnreadWhatsNewItems(items, readIds);
    return aggregateWhatsNewItems(unread, aggregateLabels).length;
  }, [items, readTick, aggregateLabels]);

  const isItemRead = useCallback(
    (item: WhatsNewItem) => {
      void readTick;
      const readIds = loadWhatsNewReadIds();
      if (readIds.has(item.id)) return true;
      if (item.id === "agg-bookings") {
        return items.filter((i) => i.kind === "booking").every((i) => readIds.has(i.id));
      }
      if (item.id === "agg-reviews") {
        return items.filter((i) => i.kind === "review").every((i) => readIds.has(i.id));
      }
      return false;
    },
    [items, readTick],
  );

  const clearUnreadBadge = useCallback(() => {
    const readIds = loadWhatsNewReadIds();
    const unread = filterUnreadWhatsNewItems(items, readIds).filter((item) => item.id !== "platform-welcome");
    markAllFeedItemsRead(unread);
    setReadTick((n) => n + 1);
  }, [items]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) clearUnreadBadge();
  };

  const onOpenItem = (item: WhatsNewItem) => {
    markWhatsNewRead(item.id);
    if (item.kind === "moderation" && item.id.startsWith("moderation-")) {
      void markJobModerationNoticeRead(item.id.replace(/^moderation-/, ""));
    }
    if (item.kind === "booking" || item.id === "agg-bookings") {
      items.filter((i) => i.kind === "booking").forEach((i) => markWhatsNewRead(i.id));
    }
    if (item.kind === "review" || item.id === "agg-reviews") {
      items.filter((i) => i.kind === "review").forEach((i) => markWhatsNewRead(i.id));
    }
    setReadTick((n) => n + 1);
    setOpen(false);
  };

  const menuContent = (
    <DropdownMenuContent align="center" className="w-[min(100vw-2rem,24rem)] p-0">
      <div className="border-b px-3 py-2 shrink-0">
        <p className="text-sm font-semibold text-foreground">{t.dashboard.whatsNew ?? "What's new"}</p>
        <p className="text-xs text-muted-foreground leading-snug">
          {t.dashboard.whatsNewHint ??
            "Updates stay here for 7 days. Opening this menu clears the notification badge."}
        </p>
      </div>
      <div className="max-h-[min(70vh,26rem)] overflow-y-auto overflow-x-hidden p-2">
        {displayItems.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t.dashboard.whatsNewEmpty ?? "You're all caught up."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {displayItems.map((item) => {
              const read = isItemRead(item);
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    onClick={() => onOpenItem(item)}
                    className={cn(
                      "block rounded-lg px-3 py-2.5 text-sm hover:bg-muted/80 transition-colors",
                      read ? "opacity-80" : "bg-muted/30",
                    )}
                  >
                    <p className={cn("text-foreground leading-snug", read ? "font-medium" : "font-semibold")}>
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
                        {item.body}
                      </p>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {showAdminPanel ? <WhatsNewAdminPanel onChanged={() => void refresh()} /> : null}
    </DropdownMenuContent>
  );

  if (variant === "mobileMenu") {
    return (
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <div className={cn("flex w-full flex-col items-center gap-2", className)}>
          {unreadCount > 0 ? (
            <div
              className="flex items-center justify-center gap-2"
              aria-label={`${unreadCount} new notification${unreadCount !== 1 ? "s" : ""}`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles size={18} />
              </span>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-destructive px-2 text-xs font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            </div>
          ) : null}
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full max-w-sm justify-center gap-2">
              <Sparkles size={16} />
              {t.dashboard.whatsNew ?? "What's new"}
            </Button>
          </DropdownMenuTrigger>
        </div>
        {menuContent}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("gap-2 shrink-0", className)}>
          <Sparkles size={16} />
          {t.dashboard.whatsNew ?? "What's new"}
          {unreadCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      {menuContent}
    </DropdownMenu>
  );
}
