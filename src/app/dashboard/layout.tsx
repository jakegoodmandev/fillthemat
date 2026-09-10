import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireOwnedSchool } from "@/lib/auth/current-school";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { school } = await requireOwnedSchool();

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground focus:text-sm"
      >
        Skip to main content
      </a>
      <aside className="flex flex-col gap-4 border-b border-border/80 p-4 md:w-52 md:shrink-0 md:border-b-0 md:border-r md:p-6 bg-card/30">
        <div className="px-1 font-semibold text-sm tracking-tight text-foreground truncate">
          {school.name}
        </div>
        <DashboardNav />
      </aside>
      <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0" id="main-content">
        {children}
      </div>
    </div>
  );
}
