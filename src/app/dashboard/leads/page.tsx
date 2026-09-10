import { formatInTimeZone } from "date-fns-tz";
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
    <main id="main-content" className="flex flex-col gap-5 px-4 py-6 md:px-6">
      <header>
        <h1 className="text-[22px] leading-7 font-semibold tracking-tight">
          Leads
        </h1>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card/40 px-4 py-8 text-sm text-muted-foreground">
          No leads yet. A lead appears when a family shares their contact
          details through your booking page.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card px-4">
          {rows.map(({ lead, contact }) => (
            <li
              key={lead.id}
              className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {contact.name}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover:text-foreground hover:underline underline-offset-4"
                    >
                      {contact.email}
                    </a>
                  ) : null}
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="hover:text-foreground hover:underline underline-offset-4"
                    >
                      {contact.phone}
                    </a>
                  ) : null}
                </div>
                {lead.participantName ? (
                  <p className="text-sm text-foreground">
                    {lead.participantName}
                    {lead.participantAge != null ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · age {lead.participantAge}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 sm:max-w-[55%] sm:text-right">
                {lead.statedNeed ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {lead.statedNeed}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {formatInTimeZone(
                    lead.createdAt,
                    school.timezone,
                    "MMM d, yyyy, h:mm a",
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
