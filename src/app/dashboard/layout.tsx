import Link from "next/link";
import { requireOwnedSchool } from "@/lib/auth/current-school";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { school } = await requireOwnedSchool();

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-zinc-800 p-6 md:w-56 md:border-b-0 md:border-r">
        <p className="text-sm font-medium">{school.name}</p>
        <nav className="flex flex-col gap-2 text-sm text-zinc-400">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/bookings">Bookings</Link>
          <Link href="/dashboard/leads">Leads</Link>
          <Link href="/dashboard/settings">Settings</Link>
        </nav>
      </aside>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
