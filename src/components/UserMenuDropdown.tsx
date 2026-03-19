import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import "./StaggeredMenu.css";

export interface UserMenuItem {
  label: string;
  link: string;
  emoji: string;
  show: boolean;
}

interface UserMenuDropdownProps {
  items: UserMenuItem[];
  onLogout: () => void;
  triggerLabel: string;
  accentColor?: string;
  triggerClassName?: string;
  /** Notification badge count (e.g. new quotes); shown next to trigger, hidden when 0 */
  notificationCount?: number;
}

export default function UserMenuDropdown({
  items,
  onLogout,
  triggerLabel,
  accentColor = "#007A56",
  triggerClassName,
  notificationCount = 0,
}: UserMenuDropdownProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open, close]);

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

  return (
    <div ref={wrapperRef} className="user-menu-wrapper" style={{ ["--sm-accent" as string]: accentColor }}>
      <div className="relative inline-block">
        <button
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
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center px-1"
            aria-label={`${notificationCount} new notification${notificationCount !== 1 ? "s" : ""}`}
          >
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
      </div>

      <div
        className={`user-menu-backdrop ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        onClick={close}
      />

      <div
        className={`user-menu-panel ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        role="menu"
      >
        <ul className="user-menu-list" role="none">
          {visibleItems.map((item, idx) => (
            <li key={item.link + idx} className="user-menu-item" role="none">
              <Link
                to={item.link}
                className="user-menu-link"
                role="menuitem"
                onClick={close}
              >
                <span className="sm-panel-itemLabel">{item.label}</span>
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
  );
}
