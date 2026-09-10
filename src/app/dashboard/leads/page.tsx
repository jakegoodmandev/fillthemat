import { desc, eq } from "drizzle-orm";
import { Mail, Phone } from "lucide-react";
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
    <main className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No leads captured yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border/60 overflow-hidden">
          {rows.map(({ lead, contact }) => {
            const dateStr = new Date(lead.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <div
                key={lead.id}
                className="p-4 flex flex-col gap-2 hover:bg-muted/20 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-sm text-foreground">
                      {contact.name}
                    </span>
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Mail className="size-3 shrink-0" />
                        <span>{contact.email}</span>
                      </a>
                    ) : null}
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Phone className="size-3 shrink-0" />
                        <span>{contact.phone}</span>
                      </a>
                    ) : null}
                  </div>
                  <span>{dateStr}</span>
                </div>

                {lead.participantName || lead.participantAge != null ? (
                  <div className="text-sm font-medium text-foreground/90">
                    Participant: {lead.participantName || "Prospective student"}{" "}
                    {lead.participantAge != null
                      ? `(age ${lead.participantAge})`
                      : ""}
                  </div>
                ) : null}

                {lead.statedNeed ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    &ldquo;{lead.statedNeed}&rdquo;
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
