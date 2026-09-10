# Settings UX — first pass (implementation notes)

Implements the first pass of `docs/settings-ux-research.md`. The seven categories
are unchanged: Profile (“School”), Offerings (“Trial classes”), Schedule,
Pricing, FAQs, Agent, Branding.

**Presentation:** owner dashboard visuals now follow
`docs/dashboard-design-system.md` (shared primitives, tokens, AlertDialog).
Route IDs, `sectionHref()`, form-state, and authorization contracts in this
file still apply.

Design thesis: the owner is teaching a helpful receptionist about their school,
not editing an AI configuration database.

## Route and navigation contract

- One route, `/dashboard/settings`, with a deep-linkable `section` query
  parameter: `?section=profile|offerings|schedule|pricing|faqs|agent|branding`.
- `?section=profile` and no parameter are the same page; `sectionHref()` in
  `src/app/dashboard/settings/sections.ts` is the only place that builds these
  URLs. Unknown values fall back to Profile.
- Categories are real `<Link>`s, so Cmd/Ctrl-click, middle-click, back, and
  forward all behave natively. A left-click with unsaved edits is intercepted
  and asks first (`settings-shell.tsx`).
- Kept as a query parameter (not nested routes) so `page.tsx` stays the single
  settings entry point and `revalidatePath("/dashboard/settings")` in every
  action stays correct.

## Files

| File | Role |
| --- | --- |
| `page.tsx` | RSC shell: resolves the section, loads only that section's data. |
| `sections.ts` | Category ids, labels, purpose copy, `sectionHref`. |
| `settings-shell.tsx` | Client shell: local nav rail + unsaved-changes guard. |
| `actions.ts` | Server Actions. Every one still calls `requireOwnedSchool()`. |
| `schemas.ts` | Zod schemas + owner-facing validation messages + limits. |
| `form-state.ts` | `SettingsFormState` returned by every action. |
| `queries.ts` | Server-only reads (kept out of `"use server"` on purpose). |
| `format.ts` | Pure formatting: times, durations, age ranges, counts. |
| `ui/*` | Labeled controls, save bar, confirm dialogs, preview panel. |
| `sections/*` | One client component per category. |

`windowHasFutureBooking` moved from `actions.ts` to `queries.ts`: exporting it
from a `"use server"` module made it a callable endpoint that accepted any
`schoolId`.

## Feedback model

Actions no longer fail silently. Each returns
`{ status, message, fieldErrors, values }`. The shared `run()` wrapper calls
`unstable_rethrow(error)` before mapping anything to form state, so Next.js
control flow — the `redirect()` inside `requireOwnedSchool()` when a session has
expired, `notFound()` — still reaches the framework instead of being reported as
a save failure. The states are:

- pending — submit button shows “Saving…”, stays enabled until the request
  starts, `aria-busy` set;
- validation — inline message under the field, `aria-invalid`, focus moves to
  the first invalid control, everything typed is preserved;
- server error — one plain sentence with a next step; nothing is lost;
- success — a sentence in a polite live region, the form re-baselines to the
  values the server stored (so “ca” becomes “CA” without looking unsaved). An
  action that reports success without echoing values back falls back to what was
  submitted, so a save can never leave the form stuck on “Unsaved changes” with a
  Discard button that would undo a write that already happened.

Saves are live. No draft/publish model for settings, and the UI says so
(“Saved changes are used by your agent right away.”).

Destructive or family-visible actions (delete FAQ, delete class time, turn off a
class time or a trial class) confirm in a native `<dialog>` — focus trap,
Escape, and backdrop for free. There is no undo, so nothing is deleted without
a confirmation.

## Restrictions the UI now explains

- Published schools: slug and time zone are locked, with a callout that says why
  and shows the current values.
- Class times on the calendar cannot be deleted — the delete button is replaced
  by the reason and the “turn it off” alternative.
- Capacity cannot drop below the students already booked in an upcoming class;
  the minimum is on the input and the server repeats it if bypassed.
- Turned-off class times cannot be reopened yet; the row says so.
- Trial classes can be edited in place (class name, youngest/oldest age,
  description, what to wear, what to expect). They cannot be deleted. Editing
  keeps the existing id, active state, `waiverNotes`, and class-time
  associations, and changing the age range affects new bookings only —
  existing reservations keep their snapshot.
- FAQs can be edited in place (question and answer) while keeping their id and
  sort position. Reordering is still unavailable, and the 20-question limit
  applies to creating new questions only, not to correcting an existing one.

## Honest previews

`ui/public-page-preview.tsx` renders a representative version of the family-facing
page (logo, school name, location, welcome message, accent color). It is labeled
“Representative view … spacing and colors on the live page may differ”, marked
“Unsaved” whenever it is showing unsaved edits, and never claims to be a test of
agent behavior. There is no interactive agent test in this pass, so no preview
can create a booking, lead, or notification.

## Deliberately out of scope (first pass)

New categories, AI model controls, website ingestion, uploads, multi-channel
settings, draft/publish for settings, schema migrations, FAQ reordering, class-
time structural editing (the Release B schedule work), reopening class times,
and in-settings agent testing.

## Inline create/edit editors (trial classes and FAQs)

Trial classes and FAQs now use a shared inline editor instead of one-shot create
forms. One editor is open per category; switching rows or opening Add while dirty
asks Keep Editing / Discard Changes, and Cancel asks before discarding a dirty
editor. The editor loads every supported saved field (not the summary text),
saves through the existing `SettingsFormState` contract, re-baselines to
server-normalized values on success, and keeps any characters typed while the
save was in flight as Unsaved changes. Successful Create reveals and focuses the
new row; successful Edit closes and returns focus to the row's Edit button.

Mutations preserve hidden data: the offering editor never writes `waiverNotes`,
`active`, or class-time associations, and both editors use the row's `updatedAt`
as an optimistic-concurrency token so a newer write returns a conflict (with
Keep Editing / Reload) instead of being silently overwritten. Browser Back/
Forward is not intercepted — only in-app link clicks and `beforeunload` are
covered (see `settings-shell.tsx`).

`createOfferingAction` already accepted `expectations` and `waiverNotes`; the
form now exposes `expectations` (the booking agent reads it) and keeps accepting
`waiverNotes` without a field, since nothing consumes it yet.

## Tests

- `bun run test` — `schemas.test.ts` (validation, normalization, and the edit
  concurrency/active-state schemas), `format.test.ts` (time/age/count
  formatting, section resolution and hrefs), and `overview/metrics.test.ts`
  (conversion-rate math including the zero-denominator `—` case).
- `bun run test:integration` — `overview/queries.integration.test.ts` (per-school
  metric fixtures: duplicate bookings per session, cancelled and no-session
  bookings, unqualified/preview sessions, and the upcoming drill-down
  reconciliation) and `settings/updates.integration.test.ts` (edit keeps id,
  `waiverNotes`, `active`, and class-time association; stale token conflicts;
  FAQ edits at the 20-question limit keep id/sort/count).
- `bun run test:e2e` — `e2e/settings.spec.ts` covers deep links, history,
  validation errors with preserved input, a successful save, server-normalized
  values, the unsaved-changes guard, add/delete with confirmation, and inline
  editing of trial classes and FAQs (save → reload → edit again; cancel
  discards without writing). `playwright.config.ts` takes its base URL from
  `.env.local` (`NEXT_PUBLIC_SITE_URL`), so it respects the worktree port
  contract.
