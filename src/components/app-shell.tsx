import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, GraduationCap, Home, PieChart, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/subjects", label: "Subjects", icon: GraduationCap },
  { to: "/reports", label: "Reports", icon: PieChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {title && (
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/60">
          <div className="mx-auto max-w-xl px-5 h-14 flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
            <div className="shrink-0">{action}</div>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-xl">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl">
        <ul className="mx-auto max-w-xl grid grid-cols-5 h-16">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex items-stretch">
                <Link
                  to={item.to}
                  className="group flex flex-1 flex-col items-center justify-center gap-1 relative"
                >
                  <span
                    className={cn(
                      "flex items-center justify-center h-7 w-14 rounded-full transition-all",
                      active ? "bg-primary-container text-on-primary-container" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className={cn("text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
