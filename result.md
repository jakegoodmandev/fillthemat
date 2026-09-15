# Recommended `@shadcn/lint` policy for fillthemat

This is a **policy proposal**, not an implementation. Zero application code was changed, `biome.json` was not touched, and no `package.json` scripts were modified. The only working-tree changes are this document and the proposed `.oxlintrc.json` (added solely to verify the config loads and to measure findings — none of the flagged code was "fixed").

## 1. The recommended config (verbatim)

`.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": ["@shadcn/lint"],
  "categories": {
    "correctness": "off",
    "suspicious": "off",
    "pedantic": "off",
    "perf": "off",
    "style": "off",
    "restriction": "off",
    "nursery": "off"
  },
  "ignorePatterns": [
    ".next/**",
    "node_modules/**",
    "dist/**",
    "build/**",
    "public/**",
    "drizzle/**",
    ".worktrees/**",
    ".agent-logs/**"
  ],
  "rules": {
    "shadcn/no-restyle": [
      "error",
      {
        "allow": ["layout"],
        "contracts": [
          {
            "pattern": "^TableCell$",
            "allow": ["layout", "typography", "text-muted-foreground"]
          }
        ]
      }
    ],
    "shadcn/no-raw-colors": "warn",
    "shadcn/no-arbitrary-values": "warn",
    "shadcn/no-inline-styles": "warn",
    "shadcn/no-unknown-classes": "warn",
    "shadcn/require-static-classes": "error"
  },
  "overrides": [
    {
      "files": ["src/components/ui/**"],
      "rules": {
        "shadcn/no-restyle": "off",
        "shadcn/no-arbitrary-values": "off",
        "shadcn/require-static-classes": "off"
      }
    }
  ]
}
```

No `settings.shadcn` block is required. Verified below.

---

## 2. Per-rule rationale (tied to code evidence)

### Design-system inventory (the evidence base)

`src/components/ui/` contains exactly: `alert-dialog.tsx`, `badge.tsx`, `button.tsx`, `input.tsx`, `label.tsx`, `native-select.tsx`, `separator.tsx`, `table.tsx`, `textarea.tsx`. There is **no Card, no Dialog (only AlertDialog), no Skeleton, no Avatar** — so the common `Card*`-style contracts from the plugin docs do not apply here.

Variants/sizes that exist (read from component source):

- **Button** — `variant`: `default | outline | secondary | ghost | destructive | link`; `size`: `default | sm | lg | icon`. Fully styled by `cva` + `buttonVariants`, takes `className` via `cn(buttonVariants(...), className)`.
- **Badge** — `variant`: `default | secondary | outline | muted | success | warning | destructive` (no size axis).
- **Input / Textarea / NativeSelect** — no variant or size API; share a plain `controlClass` string (Input exports it, Textarea and NativeSelect import it).
- **Label, Separator, Table\*, AlertDialog\*** — no variant/size API.

Theme (`src/app/globals.css`): a Tailwind v4 `@theme inline` block maps `--color-*` tokens to `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary(-foreground)`, `--secondary(-foreground)`, `--muted(-foreground)`, `--accent(-foreground)`, `--destructive`, `--border`, `--input`, `--ring`, `--success(-foreground)`, `--warning(-foreground)`, plus `--radius-sm/md/lg` and `--font-sans/mono`. Three palettes: light `:root`, dark `html.dark`, and a dashboard charcoal `.dashboard`/`[data-dashboard-theme]`. **No raw zinc/slate/neutral palette tokens are declared.**

Class merge/variant functions: `src/lib/utils.ts` exports `cn = twMerge(clsx(...))` (both built-ins). `cva` from `class-variance-authority` is used only inside `button.tsx` and `badge.tsx`. **No custom merge/variant function exists**, so `settings.shadcn.mergeFunctions` / `variantFunctions` are not needed (confirmed by reading all `cn(`/`cva(` call sites).

### `settings.shadcn` — not needed (verified)

`components.json` points the plugin at the UI dir via aliases (`@/components` → `src/components`, `@/ui` → `src/components/ui`) and the theme at `src/app/globals.css`. Discovery worked without any `settings` block: `no-restyle` recognized `Button`, `Input`, `TableCell`, and even the forwarding wrapper `TextField` ("…`<TextField>` forwards className to `<Input>`…"). All UI imports use the `@/components/ui/...` prefix, so `componentImports` is also unnecessary. The repo's only class helpers are the built-in `cn` and `cva`.

### `shadcn/no-restyle` — **error**, `allow: ["layout"]`, one contract

The flagship. Evidence that components own their appearance:

- **Button** call sites across `src/` use `variant`/`size` exclusively in ~30 of ~35 usages. The only `className`s on Button are *layout* classes: `lg:hidden` (`settings/ui/preview-panel.tsx:36`), `self-start` (`dashboard/error.tsx:21`, `settings/sections/faqs-section.tsx:149`). These pass under `allow: ["layout"]`.
- **`TableCell` is the one genuine "page controls its styling" pattern.** `dashboard/bookings/page.tsx` restyles cells per-column with typography and a muted tone: `whitespace-nowrap text-xs text-muted-foreground` (When/Contact/Email), `font-medium text-pretty`, `text-pretty`. This is real, repeated table semantics, so a contract lets it stay:
  `{ "pattern": "^TableCell$", "allow": ["layout", "typography", "text-muted-foreground"] }`.
  (Status columns already use `Badge`, so no broad `color` allowance is needed — only the exact `text-muted-foreground` tone.)
- No contract is given for Button/Badge/Input/etc. — they inherit `allow: ["layout"]`, which is the opinionated baseline the plugin is designed around.

Measured **5 errors** from this rule (details in §3): three are Input/TextField typography overrides (`font-mono`, `uppercase`), two are redundant `px-0 text-sm` on a `variant="link"` Button. All five are meaningful signals, which is why `error` (not `warn`) is the right severity here.

### `shadcn/no-raw-colors` — **warn** (deliberately not `error`)

The repo genuinely has **two palettes**: the dashboard uses the semantic tokens (`bg-card`, `border-border`, `text-muted-foreground`, `text-success/warning/destructive`), while the public/marketing/book-auth surface uses a **raw zinc palette** (`bg-white`, `border-zinc-200/300`, `text-zinc-400/500/600`, `bg-zinc-950` — e.g. `src/app/page.tsx`, `src/app/s/[slug]/*`, `src/app/onboarding/page.tsx`, `src/app/auth/error/page.tsx`, `src/components/booking-*`, `src/components/dev-email-auth.tsx`). That zinc theme is **not tokenized** in `globals.css`.

57 findings result (all zinc + 4 red). `text-red-400`/`text-red-600` map 1:1 to the existing `--destructive` token and are immediately fixable; the zinc classes require a tokenization decision that is out of scope for a lint-policy proposal. `warn` surfaces them without blocking agent work. Two tightening paths once the team tokenizes the public palette: (a) drop the zinc usage and promote to `error`, or (b) keep an explicit `allow: ["*-zinc-*"]` and promote to `error`.

### `shadcn/no-arbitrary-values` — **warn**

8 findings, each an intentional design value rather than a typo: `xl:grid-cols-[minmax(0,1fr)_18rem]` (2× settings sections), `text-[1.75rem]`/`md:text-[2rem]` (overview hero), `text-[1.375rem]` (`components/dashboard/page-header.tsx`), `tracking-[0.2em]` (`src/app/page.tsx`), `min-h-[320px]` (`booking-chat.tsx`), `max-w-[60%]` (preview logo). One is exactly on-scale (`min-h-[320px]` → `min-h-80`); the rest are close-but-not-equal. `warn` until the team decides which belong on the scale.

### `shadcn/no-inline-styles` — **warn** (one real hit, one alpha limitation)

2 findings:

- `settings/ui/public-page-preview.tsx:77` `style={{ backgroundColor: accent }}` — a real finding; the plugin's recommended fix is `style={{ "--accent": accent }}` + `bg-(--accent)`.
- `src/app/s/[slug]/page.tsx:37` `style={{ ["--school-accent" as string]: accent }}` — this is *already* the "dynamic value via custom property" pattern the docs bless, but the computed-key syntax (`["--school-accent" as string]`) defeats the alpha's static reader, so it reports "Dynamic style object cannot be checked." A plain `"--school-accent": accent` key would pass. (Notably `--school-accent` is currently unused anywhere — no `bg-(--school-accent)` consumer exists — so it may be vestigial.)

With one false positive, `warn` is the honest severity.

### `shadcn/no-unknown-classes` — **warn**

0 findings today (verified that Tailwind v4 loads, not grammar fallback: a probe with `rounded-huge flex-cols hovr:flex` reported all three with corrections). The plugin's own guidance is to start at `warn` to leave room for external/CSS-supplied classes. Clean now; safely promotable to `error`.

### `shadcn/require-static-classes` — **error**

0 findings today. It only fires when a *recognized component* receives an unreadable class value (the exact thing that would silently neuter `no-restyle`). Cheap and zero-friction to enable at `error` as a guardrail. All current dynamic classNames (`className={\`...\`}` in `section-form.tsx`, `preview-panel.tsx`, `schedule-section.tsx`, `layout.tsx`) are on plain `<div>`/`<p>`, which this rule intentionally ignores.

### Component-directory override

`src/components/ui/**` turns off `no-restyle`, `no-arbitrary-values`, and `require-static-classes` only. Rationale: components legitimately own their styling (e.g. `alert-dialog.tsx` uses `w-[min(28rem,calc(100vw-2rem))]` and `bg-black/60`; the plugin understands these are component *files*, per `docs/how-it-works.md`). `no-raw-colors`, `no-inline-styles`, and `no-unknown-classes` stay **on** inside the component dir (components already use tokens; this guards their internals too).

---

## 3. Impact estimate (measured, not guessed)

Ran `oxlint --config .oxlintrc.json` (oxlint 1.83.0, `@shadcn/lint` 0.1.0) over the repo: **175 files, 72 findings, exit code 1** (the 5 `no-restyle` errors).

| Rule | Severity | Findings | Notes |
| --- | --- | --- | --- |
| `no-restyle` | error | **5** | see breakdown below |
| `no-raw-colors` | warn | **57** | 53 zinc + 4 red; public "zinc" theme untokenized |
| `no-arbitrary-values` | warn | **8** | intentional design values, see §2 |
| `no-inline-styles` | warn | **2** | 1 real + 1 computed-key false positive |
| `no-unknown-classes` | warn | **0** | Tailwind v4 loads; no typos |
| `require-static-classes` | error | **0** | guardrail only |

`no-restyle` breakdown:

- `settings/sections/branding-section.tsx:99` — `font-mono uppercase` on `<Input>` (hex colour field).
- `settings/sections/profile-section.tsx:195` — `uppercase` on `<TextField>` (forwards to `Input`).
- `settings/sections/faqs-section.tsx:163` — `px-0` and `text-sm` on a `variant="link"` `<Button>` (both redundant: `link` already sets `px-0`, and `text-sm` is the base size — safe to delete; the intended `text-left whitespace-normal` also there is *not* flagged because `text-left` is layout and this alpha classifies `whitespace-*` as layout).

**Adoption sequencing** (recommended):

1. Land as-is. 5 `no-restyle` errors are the only "blockers"; three need a design decision (add e.g. an `uppercase`/`mono` input treatment or variant), two are straight deletions.
2. Treat `no-raw-colors` warnings as the next project: tokenize the public zinc palette, then decide `allow: ["*-zinc-*"]` vs migration, and promote to `error`.
3. Review the 8 arbitrary values and 2 inline styles; promote whichever rules end clean to `error`.

---

## 4. Deliberately left off / caveats

- **No `settings.shadcn` at all.** `components.json` discovery already covers `ui`, theme, and recognition; the only class helpers are built-ins (`cn`, `cva`). Adding settings would be noise.
- **`no-raw-colors` is `warn`, not `error`**, because the public zinc theme is a real, untokenized second palette — error would create 57 blockers with no agreed tokens to migrate to.
- **`no-restyle` has no Button/Input contract and no custom `message`.** The built-in messages already name the exact variants/sizes and file (`"Use a size (default, sm, lg, icon)… in src/components/ui/button.tsx"`), so custom `message` placeholders add nothing here. The Input typography findings are left exposed deliberately as the one decision the human should make.
- **Plugin alpha status:** `@shadcn/lint` is `0.1.0` and oxlint's JS-plugin API is documented as alpha. Observed limitations that affect this repo: the computed-key custom-property false positive (§2, `no-inline-styles`) and `whitespace-*` being classified as layout by the grammar (so `whitespace-normal` on Button is not reported). Message-placeholder behavior was not needed, so its placeholder details were not exercised.

---

## 5. What changed in this proposal

- Added `.oxlintrc.json` (the recommended config above).
- Added `result.md` (this document).
- **No** changes to application code, `biome.json`, or `package.json` scripts. General linting remains `bun run check` (Biome); this config is exclusive to `@shadcn/lint`, run via oxlint and not wired into any script.
