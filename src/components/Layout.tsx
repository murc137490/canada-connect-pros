import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, MapPin, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";

const navLinks = [
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Join the Pros", href: "/join-pros" },
  { label: "Support", href: "/support" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName =
    (user?.user_metadata?.full_name as string)?.trim() || user?.email?.split("@")[0] || user?.email || "Account";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 group">
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-white/20 dark:border-gray-700/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="container relative flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-xl">⭐</span>
            <span className="font-heading font-bold text-sm text-foreground">
              Premiere<span className="text-secondary">Services</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/40 dark:hover:bg-gray-800/40 ${
                  location.pathname === l.href ? "text-secondary" : "text-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
            <ThemeToggle />
            {user ? (
              <>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={user.email ?? undefined}>{displayName}</span>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1 h-7 text-xs">
                  <LogOut size={12} /> Log Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link to="/auth?mode=login">Log In</Link>
                </Button>
                <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-7 text-xs" asChild>
                  <Link to="/auth?mode=signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button className="p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-card pb-4">
            <nav className="container flex flex-col gap-1 pt-3">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium hover:bg-muted"
                >
                  {l.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-3 px-4">
                {user ? (
                  <>
                    <span className="text-sm text-muted-foreground truncate">{displayName}</span>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                      <LogOut size={14} /> Log Out
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link to="/auth?mode=login">Log In</Link>
                    </Button>
                    <Button size="sm" className="flex-1 bg-secondary text-secondary-foreground" asChild>
                      <Link to="/auth?mode=signup">Sign Up</Link>
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground">
        <div className="container py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">⭐</span>
                <span className="font-heading font-bold text-lg">PremiereServices</span>
              </div>
              <p className="text-sm opacity-70">
                Canada's trusted marketplace for local service professionals.
              </p>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3">Popular</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><Link to="/services" className="hover:opacity-100">Home Improvement</Link></li>
                <li><Link to="/services" className="hover:opacity-100">Snow Removal</Link></li>
                <li><Link to="/services" className="hover:opacity-100">Cleaning</Link></li>
                <li><Link to="/services" className="hover:opacity-100">Moving</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li><Link to="/support" className="hover:opacity-100">Support</Link></li>
                <li><Link to="/join-pros" className="hover:opacity-100">Become a Pro</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3">Serving All of Canada</h4>
              <div className="flex items-center gap-2 text-sm opacity-70">
                <MapPin size={14} />
                <span>Vancouver · Calgary · Toronto · Montréal · Ottawa · Halifax</span>
              </div>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-8 pt-6 text-center text-xs opacity-50">
            © {new Date().getFullYear()} PremiereServices. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
