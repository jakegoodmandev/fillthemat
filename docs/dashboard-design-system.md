# Dashboard design system

Implemented visual language for `/dashboard`. This is the current-state
reference for owner UI. Planning notes live in `docs/dashboard-makeover-plan.md`
and `docs/settings-ux-first-pass.md` (contracts there still apply; presentation
follows this file).

## Kit

- **shadcn/ui** style `radix-nova`, **Radix** primitives (`radix-ui`), Tailwind v4, existing Geist fonts.
- Source lives in `src/components/ui/`. App chrome lives in `src/components/dashboard/`.
- One variant helper: `class-variance-authority`. One class merger: `cn` in `src/lib/utils.ts`, built from `clsx` + `tailwind-merge`.
- Config: `components.json`. Do not install the full registry, charts, data-table kits, or a theme switcher.

## Tokens

Semantic colors are CSS variables. Public and auth pages keep the global
`--background` / `--foreground` pair (`#ffffff` / `#171717` in `:root`,
`#0a0a0a` / `#ededed` on `html.dark`).

Dashboard canvas and raised surfaces are scoped:

- `.dashboard` — charcoal page background and the same semantic tokens.
- `[data-dashboard-theme]` — same tokens on portaled overlays (AlertDialog).
- Component tokens (`--card`, `--muted`, `--primary`, …) are also set on
  `html.dark` so a portal to `document.body` does not lose the palette.

| Token | Use |
| --- | --- |
| `--background` / `--foreground` | Canvas and copy |
| `--card` / `--popover` | Raised surfaces and dialogs |
| `--muted` / `--muted-foreground` | Secondary regions and metadata |
| `--border` / `--input` / `--ring` | Hairlines, fields, focus |
| `--primary` | Neutral primary action (near-white on dark) |
| `--secondary` / `--accent` | Quiet fills |
| `--destructive` | Destructive actions and errors |
| `--success` / `--warning` | Status only, never as the only cue |

Pages must not invent new palettes. Status always includes a word label.

## Typography and spacing

- Geist Sans. Default UI `text-sm` (14px). Metadata `text-xs` (12px).
- Page title 22–24px (`PageHeader`). Section heading 16–18px.
- 4px base scale. 8px inside tight groups, 12–16px between related controls,
  20–24px between sections. Page padding 16px mobile, 24px desktop.
- Controls 44px tall on small screens, 36px on `md+`. Radius 6–8px on controls,
  8–12px on panels. Pills are for badges and segmented filters only.

## Components

Import from `@/components/ui/<name>` (no barrel file).

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
```

### Button

`variant`: `default` | `outline` | `secondary` | `ghost` | `destructive` | `link`  
`size`: `default` | `sm` | `lg` | `icon`  
`asChild` merges onto a Radix trigger or `Link`.

Primary action per task area uses `default`. Cancel uses `destructive`
(outline treatment, not a solid red fill). Routine secondary actions use
`outline`.

### Fields

`Input`, `Textarea`, and `NativeSelect` share `controlClass`. Keep native
`select`, `date`, `time`, `number`, and `color` controls. Settings field
adapters in `src/app/dashboard/settings/ui/controls.tsx` compose these
primitives and preserve labels, ids, errors, and existing props.

### Badge

`variant`: `default` | `secondary` | `outline` | `muted` | `success` | `warning` | `destructive`

Booking statuses: Booked `outline`, Showed `success`, No-show `warning`,
Cancelled `muted`. Always pair with the human-readable word.

### AlertDialog

Use for destructive confirms and unsaved-navigation. Overlay and content set
`data-dashboard-theme`. Cancel is first in the DOM so initial focus is safe.
Escape and the cancel action must not mutate. Confirm runs the existing server
action exactly once.

## Shell

`src/app/dashboard/layout.tsx` stays a server component (ownership check).
`DashboardNav` is the only interactive chrome. Skip link targets
`#main-content` on each page `<main>`. Do not wrap pages in a second `<main>`.
Desktop rail ~208px (`md:w-52`). Mobile nav is a compact horizontal row.

Navigation and URL-backed filters are real `<Link>`s with `aria-current="page"`.

## Copy

One page heading. No default subtitle. Navigation items are label-only.
Helpers stay only when they add a fact the label does not already convey
(locks, floors, internal-only email, timezone). Owner-facing language uses
“trial classes” and “class times”, not “offerings” or “windows”.

## Overview

`/dashboard` is the first surface a school owner sees after signing in. It is
a server component that reads the school’s credentials, runs the per-metric
SQL queries in parallel, and hands the page a tightly-shaped `metrics` object
rather than raw rows.

### Layout

Top: compact public-page status (badge, view/preview links when published;
publish flow when not).

Middle: a single grouped summary surface divided into three equal cells
(Upcoming bookings, Leads, Booking conversion). Each cell has the same
anatomy — label, value (28–32px semibold, tabular numerals), scope/evidence
sentence, optional drill-down as a real text `<a>`. Desktop dividers
between cells; stacked cells on mobile.

Below that: `Booking activity and definitions` and `System status`,
both as native disclosure summaries so the surface is calm on first load.

### Metric definitions

| Display | Definition |
| --- | --- |
| Upcoming bookings | `count(*) from bookings where school = ? and status = 'booked' and startAt >= NOW()`. Label says “Scheduled from now”; we do not invent “this week”. |
| Leads | `count(*) from leads where school = ?` over all time. Linked to `/dashboard/leads`. |
| Booking conversion | Distinct eligible public-page sessions with at least one booking, divided by the eligible-session count for the same school, all time. A session is counted at most once in the numerator; a later cancellation does not undo a booking. |
| Eligible sessions | `landingSessions` with `qualifiedAt IS NOT NULL`. The tracking excludes preview / known-bot sessions on an approved, published school but does not eliminate every bot; this number is not a booking-ready prospect count. |
| Converted sessions | `count(distinct bookings.landingSessionId)` joined back to `landingSessions` for the same school with `qualifiedAt IS NOT NULL`. We do not divide an unrelated session population by the eligible-session denominator. |
| Chat-assisted bookings | Booking-confirmation funnel events with `source = chat`. Recorded events; labelled as such. Not interchangeable with converted sessions. |
| Active trial classes / class times | Configuration counts from `trialOfferings` / `trialWindows`. Each links to the corresponding settings category. |

Empty and broken states:

- Zero denominator → `—` with “No eligible sessions yet”.
- Eligible, zero converted → `0%` with `0 of N eligible sessions`.
- We never clamp a broken calculation to 100%.
- A failed query surfaces an error boundary rather than silently substituting zeros.

### Drill-downs

- Upcoming bookings links to `/dashboard/bookings?filter=upcoming&status=booked`.
- Leads links to `/dashboard/leads`.
- Active class times links to `/dashboard/settings?section=schedule`.

The `status=booked` filter is accepted by `/dashboard/bookings`, persisted as
a removable chip, and verified not to change the meaning of the
`Upcoming`/`Past`/`All` defaults.
