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
- Trial classes cannot be edited or deleted yet; the add form says so.
- FAQs cannot be edited or reordered yet, and the 20-question limit is visible.

## Honest previews

`ui/public-page-preview.tsx` renders a representative version of the family-facing
page (logo, school name, location, welcome message, accent color). It is labeled
“Representative view … spacing and colors on the live page may differ”, marked
“Unsaved” whenever it is showing unsaved edits, and never claims to be a test of
agent behavior. There is no interactive agent test in this pass, so no preview
can create a booking, lead, or notification.

## Edit forms (inline, under the row)

This pass adds in-place editing on top of the first-pass add/delete model.
Trial classes and FAQs share a one-per-category inline editor. There is no
modal, no new route, and no Edit toggle buried in the command surface. The
shared primitives:

- A row exposes `Edit` as its primary action. `Stop Offering` / `Offer Again`
  and `Delete` stay secondary and distinct.
- One editor panel per category. Switching to another row while dirty triggers
  a `Discard changes?` confirmation. Opening Add while the current edit is
  clean is immediate.
- The editor loads every supported saved field from the record, not from the
  summary it printed on the row. Hidden fields (`active`, `waiverNotes`, FAQ
  sort order) stay intact because the action updates only the form's surface
  fields.
- The Save button starts disabled while pending, reports `Saving…` in a polite
  live region, and on server failure preserves everything the owner typed.
  Focus moves to the first invalid control.
- After a confirmed save the row updates from the normalized server values
  and the panel closes (focus returns to the row's `Edit` button). If the
  owner typed during the save, those edits are kept and the row shows
  `Unsaved changes` so a second save can confirm them.
- The same `SettingsFormState` shape applies to every editor; the create
  panel additionally focuses the new row on success without wiping anything
  typed after submission. Success announcements stay mounted after the panel
  closes; no toast-only error handling.

### Server safety

- Every mutation calls `requireOwnedSchool()` and validates input server-side.
- `updateOfferingSchema` / `updateFaqSchema` parsers accept only the supported
  fields, so the row stays `UPDATE`d against a partial column list — `active`,
  `waiverNotes`, and (for FAQs) `sortOrder` are never rewritten to empty
  defaults.
- Optimistic concurrency uses the row's `updatedAt` as the token. A stale
  edit returns the new server values as a `conflictState` so the form can
  show "Someone else saved this" and the saved inputs without overwriting
  typed values.
- The shared `run()` wrapper keeps `unstable_rethrow(error)` so Next.js
  redirects (`requireOwnedSchool()` for an expired session) still reach the
  framework instead of being turned into a stray error message.
- Affected paths revalidate: `/dashboard/settings`, `/dashboard`, and any
  public-school surface whose read depends on the saved fields.

### FAQ limit

The 20-question cap is enforced by `createFaqAction`, not by `updateFaqSchema`.
Editing an existing FAQ at the limit succeeds without dropping a row or
shifting an adjacent row's `sortOrder`, so the agent's display order stays
stable.

### Trial-class consequences surfaced in the editor

The editor copy beside the age fields says one sentence: changing age
eligibility affects new bookings only — reservations keep their snapshot. The
rest of the snapshot behaviour (name, time, location) is described once in
the editor's intro callout. The list distinguishes Offered vs. Bookable: an
offered trial class with zero active class times shows a single inline link to
Schedule rather than a misleading `available to book` count.

## Deliberately out of scope (this pass)

New categories, AI model controls, website ingestion, uploads, multi-channel
settings, draft/publish for settings, schema migrations, **new schedule
controls beyond the inline editor**, in-place FAQ reordering, and in-settings
agent testing.

`createOfferingAction` already accepted `expectations` and `waiverNotes`; the
edit form now exposes `expectations` (the booking agent reads it) and keeps
accepting `waiverNotes` without a field, since nothing consumes it yet.

## Tests

- `bun run test` — `schemas.test.ts` (validation and normalization) and
  `format.test.ts` (time/age/count formatting, section resolution and hrefs).
- `bun run test:e2e` — `e2e/settings.spec.ts` covers deep links, history,
  validation errors with preserved input, a successful save, server-normalized
  values, the unsaved-changes guard, and add/delete with confirmation for both
  FAQs and class times. `playwright.config.ts` now takes its base URL from
  `.env.local` (`NEXT_PUBLIC_SITE_URL`), so it respects the worktree port
  contract.
