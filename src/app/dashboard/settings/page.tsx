import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { faqs, trialOfferings, trialWindows } from "@/db/schema";
import { requireOwnedSchool } from "@/lib/auth/current-school";
import { listTimezones } from "@/lib/timezones";
import {
  createFaqAction,
  createOfferingAction,
  createWindowAction,
  deactivateWindowAction,
  deleteFaqAction,
  deleteWindowAction,
  toggleOfferingAction,
  updateAgentAction,
  updateBrandingAction,
  updatePricingAction,
  updateProfileAction,
  updateWindowCapacityAction,
  windowHasFutureBooking,
} from "./actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SettingsPage() {
  const { school } = await requireOwnedSchool();
  const db = getDb();
  const [offeringRows, windowRows, faqRows] = await Promise.all([
    db
      .select()
      .from(trialOfferings)
      .where(eq(trialOfferings.schoolId, school.id)),
    db.select().from(trialWindows).where(eq(trialWindows.schoolId, school.id)),
    db.select().from(faqs).where(eq(faqs.schoolId, school.id)),
  ]);
  const published = school.publishedAt != null;
  const timezones = listTimezones();
  const frozen = await Promise.all(
    windowRows.map(async (window) => ({
      id: window.id,
      frozen: await windowHasFutureBooking(school.id, window.id),
    })),
  );
  const frozenIds = new Set(
    frozen.filter((row) => row.frozen).map((row) => row.id),
  );

  return (
    <main className="flex max-w-3xl flex-col gap-10">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Profile</h2>
        <form action={updateProfileAction} className="grid gap-3">
          <input
            name="name"
            defaultValue={school.name}
            required
            className={inputClass}
          />
          <input
            name="slug"
            defaultValue={school.slug}
            disabled={published}
            className={inputClass}
          />
          <select
            name="timezone"
            defaultValue={school.timezone}
            disabled={published}
            className={inputClass}
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <input
            name="notificationEmail"
            type="email"
            defaultValue={school.notificationEmail}
            className={inputClass}
          />
          <input
            name="phone"
            defaultValue={school.phone ?? ""}
            placeholder="Phone"
            className={inputClass}
          />
          <input
            name="website"
            defaultValue={school.website ?? ""}
            placeholder="https://..."
            className={inputClass}
          />
          <input
            name="address"
            defaultValue={school.address ?? ""}
            placeholder="Address"
            className={inputClass}
          />
          <input
            name="city"
            defaultValue={school.city ?? ""}
            placeholder="City"
            className={inputClass}
          />
          <input
            name="country"
            defaultValue={school.country}
            maxLength={2}
            className={inputClass}
          />
          <textarea
            name="parkingNotes"
            defaultValue={school.parkingNotes ?? ""}
            placeholder="Parking"
            className={inputClass}
          />
          <textarea
            name="accessNotes"
            defaultValue={school.accessNotes ?? ""}
            placeholder="Access"
            className={inputClass}
          />
          <textarea
            name="trialGuidance"
            defaultValue={school.trialGuidance ?? ""}
            placeholder="Trial guidance"
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Save profile
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Offerings</h2>
        <ul className="space-y-2 text-sm">
          {offeringRows.map((offering) => (
            <li
              key={offering.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
            >
              <span>
                {offering.name} {offering.active ? "" : "(inactive)"}
              </span>
              <form action={toggleOfferingAction}>
                <input type="hidden" name="id" value={offering.id} />
                <input
                  type="hidden"
                  name="active"
                  value={String(offering.active)}
                />
                <button type="submit" className="underline">
                  {offering.active ? "Deactivate" : "Activate"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createOfferingAction} className="grid gap-2">
          <input
            name="name"
            required
            placeholder="Kids beginner trial"
            className={inputClass}
          />
          <textarea
            name="description"
            placeholder="Description"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              name="minimumAge"
              type="number"
              min={0}
              max={99}
              placeholder="Min age"
              className={inputClass}
            />
            <input
              name="maximumAge"
              type="number"
              min={0}
              max={99}
              placeholder="Max age"
              className={inputClass}
            />
          </div>
          <input
            name="attire"
            placeholder="What to wear"
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Add offering
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Schedule</h2>
        <ul className="space-y-2 text-sm">
          {windowRows.map((window) => (
            <li
              key={window.id}
              className="rounded-lg border border-zinc-800 p-3"
            >
              <p>
                {DAYS[window.dayOfWeek]} at{" "}
                {Math.floor(window.startMinute / 60)}:
                {String(window.startMinute % 60).padStart(2, "0")} ·{" "}
                {window.durationMinutes}m · cap {window.capacity}
                {window.active ? "" : " (inactive)"}
                {frozenIds.has(window.id) ? " · frozen" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <form
                  action={updateWindowCapacityAction}
                  className="flex gap-2"
                >
                  <input type="hidden" name="id" value={window.id} />
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={window.capacity}
                    className={inputClass}
                  />
                  <button type="submit" className="underline">
                    Update capacity
                  </button>
                </form>
                {window.active ? (
                  <form action={deactivateWindowAction}>
                    <input type="hidden" name="id" value={window.id} />
                    <button type="submit" className="underline">
                      Deactivate
                    </button>
                  </form>
                ) : null}
                {!frozenIds.has(window.id) ? (
                  <form action={deleteWindowAction}>
                    <input type="hidden" name="id" value={window.id} />
                    <button type="submit" className="underline">
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <form action={createWindowAction} className="grid gap-2">
          <select name="trialOfferingId" required className={inputClass}>
            {offeringRows.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.name}
              </option>
            ))}
          </select>
          <select name="dayOfWeek" className={inputClass}>
            {DAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input
              name="startHour"
              type="number"
              min={0}
              max={23}
              defaultValue={18}
              className={inputClass}
            />
            <input
              name="startMinute"
              type="number"
              min={0}
              max={59}
              defaultValue={0}
              className={inputClass}
            />
            <input
              name="durationMinutes"
              type="number"
              min={15}
              defaultValue={60}
              className={inputClass}
            />
          </div>
          <input
            name="capacity"
            type="number"
            min={1}
            max={50}
            defaultValue={8}
            className={inputClass}
          />
          <input name="label" placeholder="Label" className={inputClass} />
          <button type="submit" className={buttonClass}>
            Add window
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Pricing</h2>
        <form action={updatePricingAction} className="grid gap-2">
          <textarea
            name="pricing"
            defaultValue={school.pricing ?? ""}
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Save pricing
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">FAQs</h2>
        <ul className="space-y-2 text-sm">
          {faqRows.map((faq) => (
            <li key={faq.id} className="rounded-lg border border-zinc-800 p-3">
              <p className="font-medium">{faq.question}</p>
              <p className="text-zinc-400">{faq.answer}</p>
              <form action={deleteFaqAction}>
                <input type="hidden" name="id" value={faq.id} />
                <button type="submit" className="underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createFaqAction} className="grid gap-2">
          <input
            name="question"
            required
            maxLength={200}
            placeholder="Question"
            className={inputClass}
          />
          <textarea
            name="answer"
            required
            maxLength={2000}
            placeholder="Answer"
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Add FAQ
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Agent</h2>
        <form action={updateAgentAction} className="grid gap-2">
          <textarea
            name="welcomeMessage"
            defaultValue={school.welcomeMessage ?? ""}
            placeholder="Welcome message"
            className={inputClass}
          />
          <textarea
            name="agentInstructions"
            defaultValue={school.agentInstructions ?? ""}
            placeholder="Tone and qualification notes"
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Save agent
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Branding</h2>
        <form action={updateBrandingAction} className="grid gap-2">
          <input
            name="logoUrl"
            defaultValue={school.logoUrl ?? ""}
            placeholder="https://.../logo.png"
            className={inputClass}
          />
          <input
            name="primaryColor"
            defaultValue={school.primaryColor ?? ""}
            placeholder="#123456"
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Save branding
          </button>
        </form>
      </section>
    </main>
  );
}

const inputClass =
  "rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm";
const buttonClass =
  "h-10 rounded-full bg-foreground px-4 text-sm font-medium text-background";
