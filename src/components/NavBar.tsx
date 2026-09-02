import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarClock, Gauge, Map as MapIcon, User, Zap } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Map", icon: MapIcon },
  { to: "/booking", label: "Booking", icon: CalendarClock },
  { to: "/operator", label: "Operator", icon: Gauge },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export default function NavBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Top bar (all sizes) */}
      <header className="fixed inset-x-0 top-0 z-[900] border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-glow">
              <Zap className="h-4.5 w-4.5 text-primary-foreground" />
            </span>
            <span className="font-display text-base font-bold tracking-tight">
              EcoPulse <span className="text-primary">EV</span>
            </span>
          </Link>
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
          </nav>
        </div>
      </header>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-[900] border-t border-border bg-background/90 backdrop-blur-md sm:hidden">
        <div className="grid grid-cols-4">
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
        </div>
      </nav>
    </>
  );
}
