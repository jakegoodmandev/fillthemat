# Dashboard design system

The owner-facing dashboard uses one small design system built from shadcn/ui
component source (Radix primitives), Tailwind CSS v4 tokens, and the existing
Geist fonts. This file records the implemented tokens and the conventions every
dashboard route should follow. It is documentation of current behavior, not a
proposal.

## Tokens

Semantic tokens live in `src/app/globals.css` as CSS custom properties and are
mapped into Tailwind utilities via `@theme inline`. The dark values apply to the
whole app (the root layout sets `<html class="dark">`); the public `/s/[slug]`
page wraps itself in its own light surface, so the dark tokens never leak onto
it, and portaled dialogs inherit the dark tokens from `<html>`.

| Token | Dark value | Meaning |
| --- | --- | --- |
| `background` | `#17171b` | Charcoal page canvas. |
| `foreground` | `#ececef` | Primary text. |
| `card` | `#1f1f26` | Raised surface (cards, lists, dialogs, tables). |
| `card-foreground` | `#ececef` | Text on cards. |
| `popover` / `popover-foreground` | `#1f1f26` / `#ececef` | Portaled overlays. |
| `primary` / `primary-foreground` | `#ececef` / `#1a1a1f` | Neutral primary action (light button). |
| `secondary` / `secondary-foreground` | `#2a2a32` / `#ececef` | Secondary buttons, hover fills. |
| `muted` / `muted-foreground` | `#2a2a32` / `#a4a4ae` | Quiet fills and secondary text. |
| `accent` / `accent-foreground` | `#2a2a32` / `#ececef` | Active nav, segmented selected state. |
| `destructive` / `destructive-foreground` | `#f87171` / `#2a0b0d` | Destructive actions and errors. |
| `success` / `success-foreground` | `#4ade80` / `#0c2014` | Confirmation, "Showed", "Published". |
| `warning` / `warning-foreground` | `#f5b942` / `#241a04` | "No-show", unsaved, failure counts. |
| `border` | `#2a2a32` | Restrained borders (dividers, inputs). |
| `input` | `#2a2a32` | Input/select borders. |
| `ring` | `#7d7d8c` | Visible focus ring. |

Native controls (`select`, `input[type=time|number|color]`) use `background` and
`foreground` plus `color-scheme: dark` so they tuck in without a custom select.

Contrast: `muted-foreground` on `background` measures ~7.2:1 and on `card`
~6.6:1; `destructive`, `success`, and `warning` text on `background` all exceed
6:1. Everything intended for reading clears WCAG AA.

## Component inventory

Source lives in `src/components/ui/` (shadcn-style primitives) and
`src/components/dashboard/` (dashboard-specific layout). The kit-style class
joiner is the `cn` package (`import { cn } from "cn"`).

- `src/components/ui/button.tsx` — `Button`, `buttonVariants`. Variants:
  `default`, `secondary`, `outline`, `ghost`, `link`, `destructive`. Sizes:
  `default` (36px), `sm` (32px), `lg`, `icon`, `icon-sm`. Use `asChild` to wrap
  a `Link` or Radix trigger instead of nesting a button inside an anchor.
- `src/components/ui/input.tsx`, `textarea.tsx` — base `.input`-like surfaces.
- `src/components/ui/label.tsx`, `separator.tsx`, `badge.tsx`, `table.tsx`.
- `src/components/ui/alert-dialog.tsx` — Radix AlertDialog. The confirm action
  takes `variant`; destructive confirmations default focus to the Cancel button
  (safe default) because Radix focuses `AlertDialogCancel` on open. Escape and
  backdrop dismissal do not trigger the action.

`src/app/dashboard/settings/ui/controls.tsx` is the settings-specific field
adapter: `TextField`, `TextAreaField`, `SelectField` (native `select`),
`FieldGroup` (borderless heading + fields), `Callout`, `Badge`, `EmptyState`. It
composes the shared primitives — there is no competing Button or Input
implementation.

## Density and spacing

- Base scale 4px: `gap-1`/`gap-1.5` within tight groups, `gap-3`(12px)–
  `gap-4`(16px) between related controls, `gap-6`(24px) between sections.
- Page padding is `px-4 py-6` mobile, `md:px-6` desktop.
- Default UI text is 14px (`text-sm`); secondary metadata 12px (`text-xs`);
  page title `text-[22px]`; section heading `text-base`/`text-sm`.
- Controls target ~36px (Button `h-9`, Input `h-9`) on desktop; touch targets
  stay comfortably tappable on mobile. Do not shrink hit targets for density.
- Radii: controls `rounded-md` (6px), panels/rows `rounded-lg` (8px). Pills are
  for badges, not every button.

## Layout conventions

- The dashboard shell (`src/app/dashboard/layout.tsx` + `src/components/dashboard/nav.tsx`)
  renders a skip link, one `<aside>` with school identity + global nav, and the
  page content. Pages render their own `<main id="main-content">` — the shell
  never nests a second `<main>`.
- Active nav uses `aria-current="page"`; the nav marks the active route with
  `bg-accent` and `text-foreground`.
- One page heading per route. No default subtitle; the settings intro and
  per-section purpose paragraphs were removed. Explanations stay only where a
  label alone would mislead, placed next to the relevant control.
- Lists (bookings/leads) use divided `rounded-lg border bg-card` surfaces, not
  nested cards. Overview uses three summary cards + a dense definition-list
  "Funnel" surface + a collapsed "System status" `<details>`.
- Tables use the shared `Table` surface; bookings switches to stacked records
  below `md` so the page never scrolls horizontally.

## Status vocabulary

Status is always words + color, never color alone.

| Domain | Value | Rendering |
| --- | --- | --- |
| Publish state | `Published` / `Unpublished` | `Badge` success / muted. |
| Booking | `booked` / `showed` / `no_show` / `cancelled` | `Booked` outline, `Showed` success, `No-show` warning, `Cancelled` muted. |
| Email delivery | `sent/delivered` / `pending/claimed` / `failed/bounced/complained` | muted / muted / destructive text. |
| Trial class | `active` | `Offered` success / `Not offered` muted. |
| Class time | `active` | `Open` success / `Turned off` muted; `Upcoming bookings` warning. |
| Unsaved edits | — | `Unsaved` warning badge + `role="status"` text. |
| Form state | pending / success / error | `section-form.tsx` `SectionStatus` polite live region. |

## Usage examples

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

<Button size="sm">Publish</Button>
<Button variant="outline" size="sm">Preview</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button asChild variant="outline"><Link href="/dashboard/settings">Settings</Link></Button>

<Badge variant="success">Published</Badge>
<Badge variant="warning">No-show</Badge>
```

Confirmation (dismissing does nothing; confirming runs the server action once):

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="sm" className="text-destructive">Cancel</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
      <AlertDialogDescription>…honest consequence…</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep booking</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={submit}>Cancel booking</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```
