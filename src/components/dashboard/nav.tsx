"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex">
      <ul className="flex w-full gap-1 overflow-x-auto overscroll-x-contain md:flex-col md:overflow-x-visible">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <li key={link.href} className="shrink-0 md:shrink">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
