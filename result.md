# @shadcn/lint policy — adoption + compliance result

This extends PR #39's `@shadcn/lint` + oxlint setup with the recommended rule
policy and fixes the whole codebase so `bun run lint` reports **zero findings**
(errors and warnings), exit 0.

## 1. Final config

`.oxlintrc.json` was replaced **verbatim** with the recommended policy from the
approved proposal (PR #40): all six `shadcn/*` rules, `no-restyle` at `error`
with `allow: ["layout"]` and the `^TableCell$` contract, the remaining rules at
their recommended severities, and the `src/components/ui/**` override. **No
deviations from the recommended config were needed** — the config loads and the
plugin recognizes `Input`/`TextField`/`Button`/`TableCell` via `components.json`
discovery.

Scope note: `ignorePatterns` includes `.worktrees/**`. A lint run from inside
this worktree still scans `src/` (the ignore is for *paths within the scanned
tree*, and `src/` does not live under `.worktrees/`), and the reported 72
findings matched the proposal's measured run exactly, confirming `oxlint .`
scans the real `src/` rather than the worktree directory artifacts.

## 2. Finding → fix summary

| Rule | Findings | Approach |
| --- | --- | --- |
| `no-restyle` (error) | 5 | 2 redundant `px-0 text-sm` on a `variant="link"` Button deleted; 3 typography overrides moved into a new `Input` variant (see §3). |
| `no-raw-colors` (warn) | 57 | Tokenized the public zinc/red palette into a `--color-page-*` scale (`--color-page-50…950`, `--color-page-error`); mapped `text-red-400` → `text-destructive` (1:1 under the always-dark `<html>`) and `text-red-600` → `text-page-error`. See §4. |
| `no-arbitrary-values` (warn) | 8 | `min-h-[320px]` → `min-h-80`; the rest became scoped theme tokens (see §4): `grid-cols-[minmax(0,1fr)_18rem]` → `grid-cols-(--settings-page-columns)`, `tracking-[0.2em]` → `tracking-eyebrow`, `max-w-[60%]` → `max-w-preview-logo`, metric/hero text sizes → `text-(length:--text-*)`. |
| `no-inline-styles` (warn) | 2 | Preview accent → `style={{ "--accent": accent }}` + `bg-(--accent)`; the computed-key `--school-accent` custom property was dead code and removed (see §5). |
| `no-unknown-classes` | 0 | stayed clean. |
| `require-static-classes` (error) | 0 | stayed clean. |

## 3. Input typography decision (`no-restyle`)

The three typography overrides were:

- `settings/sections/branding-section.tsx` hex field: `font-mono uppercase` on `<Input>`.
- `settings/sections/profile-section.tsx` country field: `uppercase` on `<TextField>` (forwards `className` to `<Input>`).

I added a **`variant` API to `Input`** (via `cva`, matching the `button.tsx` /
`badge.tsx` convention) with two values:

- `variant="code"` → `font-mono uppercase` (hex color codes);
- `variant="uppercase"` → `uppercase` (two-letter country codes, kept in the
  default sans font — the casing is a real UX nicety and the schema also
  normalizes to uppercase on submit, so the display must match).

`TextField` now takes a `variant` and forwards it to `Input` instead of
forwarding an arbitrary `className`. This keeps `no-restyle` meaningful: call
sites can no longer reach into `Input`'s typography via `className`, and the
override lives in the component that owns the styles. No `Input`/`TextField`
contract was added.

## 4. Public palette tokenization (`no-raw-colors`) + arbitrary values

`src/app/globals.css` gains a static `@theme` block (separate from the existing
`@theme inline`, which maps the reactive dashboard tokens):

- `--color-page-50…950` — the public surface's neutral ramp, each value equal
  to Tailwind's `zinc-*` step (e.g. `--color-page-950: #09090b`), so every
  `bg-`/`border-`/`text-zinc-*` usage is replaced 1:1 with `*-page-*` with no
  pixel change.
- `--color-page-error: #dc2626` — for `text-red-600` on the light booking form.
- `--color-page-accent-default: #111111` — the "default dark accent" fallback,
  referenced via `var()` so `no-inline-styles` accepts the dynamic accent.
- Scoped design tokens for the arbitrary values: `--tracking-eyebrow: 0.2em`,
  `--text-metric: 1.75rem`, `--text-metric-lg: 2rem`, `--text-page-title:
  1.375rem`, `--container-preview-logo: 60%`, and `--settings-page-columns:
  minmax(0, 1fr) 18rem`.

`text-red-400` (onboarding error, dev-email-auth error) maps to
`text-destructive`: `<html>` always carries `dark`, so `--destructive` resolves
to `#f87171` = `red-400`, exactly.

**Gotcha discovered:** `--text-*` theme tokens surface as `text-<name>` classes,
which the plugin's `cn`-grammar classifier misreads as *color* utilities, so
`text-metric` was flagged by `no-raw-colors` as "not a declared theme color".
The disambiguating Tailwind v4 syntax `text-(length:--text-metric)` both sets
`font-size: var(--text-metric)` correctly and passes every rule. (The `18rem`
sidebar and `minmax` grid template likewise use the `grid-cols-(--var)` form and
`60%` uses a `--container-*` token, generating `max-w-preview-logo`.)

## 5. Inline styles (`no-inline-styles`)

- `PublicPagePreview`: `backgroundColor: accent` → `style={{ "--accent": accent }}`
  + `bg-(--accent)` (the plugin's documented dynamic-value pattern). The accent
  fallback was changed to `var(--color-page-accent-default)` so the rule's
  "custom property hardcodes a color" check passes; the rendered pixel is
  identical.
- `src/app/s/[slug]/page.tsx`: the `["--school-accent" as string]` property was
  a routing-dead value (no `bg-(--school-accent)` consumer exists anywhere). The
  plain-key form alone would still trip `no-inline-styles`'s hardcoded-color
  check (`school.primaryColor ?? "#111111"` contains a literal), so instead of
  keeping a dead property I removed it along with the now-unused `accent` const.
  Zero rendered change; the live public page never consumed it.

## 6. Verification

- `bun run lint` → 0 findings, exit 0.
- `bun run check` (Biome) → 0 errors, exit 0.
- `bun run build` (Next 16 / Turbopack) → success; TypeScript passes; compiled
  CSS confirms `font-size: var(--text-metric)` (1.75rem/2rem), `--settings-page-columns:
  minmax(0,1fr) 18rem`, `max-width: 60%`, `letter-spacing: .2em`, and the
  `*-page-*` tokens resolving to their exact zinc hexes.
- `bun run test` (Vitest) → 22 files, 112 tests passed.
- `bun run test:e2e` not run: it requires a dev server + Supabase, and the
  plan's port contract forbids starting another dev server/Supabase from this
  worktree.

Build note: the worktree's `node_modules` is a symlink to the shared checkout,
which Turbopack rejects ("symlink points out of the filesystem root"). For
verification I replaced it with a hard-linked copy (`cp -al`) so `next build`
could run; this is purely a local infra workaround (untracked, not committed)
and unrelated to the code changes.

## 7. Caveats

- `@shadcn/lint` is `0.1.0`; its `cn`-grammar classifier caused the `text-*`
  font-size collision above (worked around with `length:`), worth remembering
  when adding future font-size tokens.
- `no-raw-colors`/`no-arbitrary-values`/`no-inline-styles` remain `warn` per the
  recommended policy. They are now at zero findings, so each is safely
  promotable to `error` in a follow-up if desired.
