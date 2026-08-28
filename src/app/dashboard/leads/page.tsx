import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contacts, leads } from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";

export default async function LeadsPage() {
  const { school } = await requireOwnedSchool();
  const db = getDb();
  const rows = await db
    .select({
      lead: leads,
      contact: contacts,
    })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .where(eq(leads.schoolId, school.id))
    .orderBy(desc(leads.createdAt));

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <ul className="space-y-3 text-sm">
        {rows.map(({ lead, contact }) => (
          <li key={lead.id} className="rounded-xl border border-zinc-800 p-4">
            <p className="font-medium">
              {contact.name} · {contact.email} · {contact.phone}
            </p>
            <p className="text-zinc-400">
              {lead.participantName ?? "No participant"}{" "}
              {lead.participantAge != null
                ? `(age ${lead.participantAge})`
                : ""}
            </p>
            <p>{lead.statedNeed ?? "No stated need"}</p>
            <p className="text-zinc-500">{lead.createdAt.toISOString()}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
