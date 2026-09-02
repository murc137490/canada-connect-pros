import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import "./StaggeredMenu.css";

export interface UserMenuItem {
  label: string;
  link: string;
  emoji: string;
  show: boolean;
  /** Optional unread count badge on this row (e.g. booking history). */
  badge?: number;
}

interface UserMenuDropdownProps {
  items: UserMenuItem[];
  onLogout: () => void;
  triggerLabel: string;
  accentColor?: string;
  triggerClassName?: string;
  /** Extra class on the dropdown panel (e.g. user-menu-panel--dashboard). */
  panelClassName?: string;
  /** Notification badge count (e.g. new quotes); shown next to trigger, hidden when 0 */
  notificationCount?: number;
}

export default function UserMenuDropdown({
  items,
  onLogout,
  triggerLabel,
  accentColor = "#007A56",
  triggerClassName,
  panelClassName,
  notificationCount = 0,
}: UserMenuDropdownProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  /** Portal panel under body so backdrop-filter can blur the real page (not a clipped header). */
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const place = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      if (mobile) {
        // Position via CSS (centered); avoid inline transform — it kills glass open anim + blur.
        setPanelStyle({
          position: "fixed",
          width: undefined,
          left: undefined,
          right: undefined,
          top: undefined,
          transform: undefined,
        });
        return;
      }
      const width = Math.min(384, Math.max(280, window.innerWidth * 0.9));
      let left = rect.right - width;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left,
        right: "auto",
        width,
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const navigate = useNavigate();
  const handleLogout = useCallback(() => {
    close();
    onLogout();
    navigate("/");
  }, [close, onLogout, navigate]);

  const visibleItems = items.filter((i) => i.show);

  const menuPortal =
    typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              className={`user-menu-backdrop ${open ? "is-open" : ""}`}
              aria-hidden={!open}
              onClick={close}
            />
            <div
              ref={panelRef}
              className={`user-menu-panel ${panelClassName ?? ""} ${open ? "is-open" : ""}`.trim()}
              style={{ ["--sm-accent" as string]: accentColor, ...panelStyle }}
              aria-hidden={!open}
              role="menu"
            >
              <div className="user-menu-panel__glass">
                <ul className="user-menu-list" role="none">
                  {visibleItems.map((item, idx) => (
                    <li key={item.link + idx} className="user-menu-item" role="none">
                      <Link to={item.link} className="user-menu-link" role="menuitem" onClick={close}>
                        <span className="sm-panel-itemLabel inline-flex items-center gap-2">
                          {item.label}
                          {item.badge != null && item.badge > 0 && (
                            <span className="min-w-[1.125rem] h-[1.125rem] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="user-menu-logout">
                  <button
                    type="button"
                    className="user-menu-link w-full justify-start bg-transparent border-none cursor-pointer"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    <span className="sm-panel-itemLabel">{t.nav.logOut}</span>
                    <LogOut size={18} className="ml-auto opacity-70" />
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapperRef} className="user-menu-wrapper" style={{ ["--sm-accent" as string]: accentColor }}>
      <div className="relative inline-block">
        <button
          ref={triggerRef}
          type="button"
          className={`user-menu-trigger ${triggerClassName ?? ""}`.trim()}
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Account menu"
        >
          <User size={18} />
          <span className="hidden sm:inline">{triggerLabel}</span>
        </button>
        {notificationCount > 0 && (
          <span
            className="absolute -top-1 -right-1 hidden min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-xs font-bold 2xl:flex items-center justify-center px-1"
            aria-label={`${notificationCount} new notification${notificationCount !== 1 ? "s" : ""}`}
          >
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
      </div>
      {menuPortal}
    </div>
  );
}
