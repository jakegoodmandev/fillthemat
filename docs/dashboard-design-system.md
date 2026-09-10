# Dashboard Design System

This document outlines the presentation tokens, component APIs, visual conventions, spacing, and status variants for the Fillthemat owner dashboard.

## Overview & Architecture

The owner dashboard uses a quiet, compact, softened-dark theme built with shadcn/ui component primitives, Radix UI primitives, Tailwind CSS v4, and Geist fonts (`GeistSans`, `GeistMono`).

Components are located in:
- `src/components/ui/` — Design system primitives (`Button`, `Input`, `Textarea`, `Label`, `Badge`, `Separator`, `Table`, `AlertDialog`).
- `src/components/dashboard/` — Shell & layout helpers (`DashboardNav`, `CancelBookingButton`).
- `src/app/dashboard/settings/ui/` — Settings-specific field controls (`TextField`, `TextAreaField`, `SelectField`, `FieldGroup`, `SaveBar`, `ItemActionForm`, `Callout`, `EmptyState`).

---

## Token Specifications (`src/app/globals.css`)

### Theme Color Palette

| CSS Variable | Dark Mode Value | Usage |
| --- | --- | --- |
| `--background` | `#09090b` | App canvas / background |
| `--card`, `--popover` | `#121215` | Raised surface panels & cards |
| `--foreground` | `#f4f4f5` | Primary text |
| `--muted` | `#1c1c21` | Secondary control backgrounds |
| `--muted-foreground` | `#a1a1aa` | Muted / metadata text |
| `--border`, `--input` | `#27272a` | Dividers & control borders |
| `--primary` | `#f4f4f5` | Primary action background |
| `--primary-foreground` | `#09090b` | Text on primary action |
| `--secondary` | `#27272a` | Secondary buttons / active nav |
| `--secondary-foreground` | `#f4f4f5` | Text on secondary action |
| `--destructive` | `#7f1d1d` | Destructive action surface |
| `--destructive-foreground` | `#fef2f2` | Text on destructive surface |
| `--ring` | `#52525b` | Focus ring outline |
| `--radius` | `0.5rem` (8px) | Corner radius base |

---

## Typography & Spacing

### Scale & Hierarchy
- **Page Titles (`h1`)**: `text-2xl font-semibold tracking-tight` (24px)
- **Section Headings (`h2`/`h3`)**: `text-lg font-semibold` (18px) or `text-sm font-semibold` (14px)
- **Body / Primary UI**: `text-sm` (14px default UI text)
- **Metadata / Secondary**: `text-xs` (12px)
- **Font Families**: `--font-sans` (`GeistSans`), `--font-mono` (`GeistMono`)

### Spacing Guidelines
- Base scale: 4px
- **Tight groupings**: 8px (`gap-2`)
- **Control / Form field groups**: 12–16px (`gap-3` / `gap-4`)
- **Page Sections**: 24px (`gap-6`)
- **Desktop Page Padding**: 24–32px (`p-6` / `p-8`)
- **Mobile Page Padding**: 16px (`p-4`)

---

## Status Variants (`Badge`)

| Variant / Tone | Classes | Context |
| --- | --- | --- |
| `default` | `bg-primary text-primary-foreground` | Primary status |
| `outline` | `border-border text-foreground` | Standard / neutral status (e.g. Booked) |
| `secondary` | `border-border text-muted-foreground bg-muted/20` | Inactive / Cancelled status |
| `success` / `active` | `border-emerald-800/40 bg-emerald-950/60 text-emerald-300` | Published / Showed / Offered |
| `warning` | `border-amber-800/40 bg-amber-950/60 text-amber-300` | Unpublished / No-show / Unsaved |
| `destructive` | `border-transparent bg-destructive text-destructive-foreground` | Failed / Critical alert |

---

## Key Component APIs & Examples

### Button (`src/components/ui/button.tsx`)
```tsx
import { Button } from "@/components/ui/button";

<Button variant="default" size="sm">Publish</Button>
<Button variant="outline" size="sm">Preview page</Button>
<Button variant="ghost" size="sm">Cancel</Button>
```

### AlertDialog (`src/components/ui/alert-dialog.tsx`)
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogTrigger asChild>
    <Button variant="ghost">Cancel</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep booking</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>;
```

### Table (`src/components/ui/table.tsx`)
```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>When</TableHead>
      <TableHead>Participant</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Sat, Oct 12 • 10:00 AM</TableCell>
      <TableCell>Alex Smith</TableCell>
      <TableCell><Badge variant="outline">Booked</Badge></TableCell>
    </TableRow>
  </TableBody>
</Table>
```
