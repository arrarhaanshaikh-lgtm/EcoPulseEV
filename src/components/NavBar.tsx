import { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  CalendarClock,
  Gauge,
  Map as MapIcon,
  User,
  Zap,
  LogIn,
  LogOut,
  Route as RouteIcon,
} from "lucide-react";
import { AuthModal } from "./AuthModal";
import { getCurrentUser, signOutUser, type AuthUser, type UserRole } from "../lib/auth";

const ITEMS = [
  { to: "/", label: "Map", icon: MapIcon },
  { to: "/booking", label: "Booking", icon: CalendarClock },
  { to: "/operator", label: "Operator", icon: Gauge },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function NavBar() {
  const { pathname } = useLocation();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        if (typeof getCurrentUser === "function") {
          const user = await getCurrentUser();
          if (user) setCurrentUser(user);
        }
      } catch (err) {
        console.warn("Auth check failed:", err);
      }
    }
    fetchUser();
  }, []);

  const handleAuthSuccess = (role: UserRole, email: string) => {
    setCurrentUser({ id: "user-" + Date.now(), email, role });
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
  };

  const handleScrollToPlanner = () => {
    if (pathname !== "/") {
      window.location.href = "/#highway-planner";
    } else {
      const el = document.getElementById("highway-planner");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <>
      {/* Top bar (all sizes) */}
      <header className="fixed inset-x-0 top-0 z-[900] border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-glow">
              <Zap className="h-4.5 w-4.5 text-primary-foreground" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              EcoPulse <span className="text-primary">EV</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-1 sm:flex">
              {ITEMS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname === to
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              ))}

              {/* Highway Planner Quick Link */}
              <button
                type="button"
                onClick={handleScrollToPlanner}
                className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                <RouteIcon className="h-3.5 w-3.5" />
                <span>Planner</span>
              </button>
            </nav>

            {/* Authentication Button, Badge & Safe Sign Out */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden font-mono text-xs text-foreground sm:inline">
                    {currentUser.email}
                  </span>
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                  title="Sign Out Safely"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-[900] border-t border-border bg-background/90 backdrop-blur-md sm:hidden">
        <div className="grid grid-cols-5">
          {ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${
                pathname === to ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleScrollToPlanner}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold text-emerald-400"
          >
            <RouteIcon className="h-5 w-5" />
            Planner
          </button>
        </div>
      </nav>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}

export default NavBar;