import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/nav";
import { requireOwnedSchool } from "@/lib/auth/current-school";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { school } = await requireOwnedSchool();

  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="flex-none border-b border-border bg-card/40 md:min-h-svh md:w-52 md:border-b-0 md:border-r">
        <div className="flex w-full flex-col gap-3 px-4 py-3 md:sticky md:top-0 md:px-4 md:py-6">
          <Link
            href="/dashboard"
            className="truncate text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-md"
          >
            {school.name}
          </Link>
          <DashboardNav />
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
