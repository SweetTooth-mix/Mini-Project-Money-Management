# DESIGN.md — permanent design rules for Kira Rapi

This file is a contract, not a mood board. Every future change to the interface — human or
agent — must satisfy it. If a request conflicts with a rule here, stop and raise the conflict
instead of silently adding a new pattern.

Scope: `app/globals.css`, `app/**/page.tsx`, `components/**`. The Excel/PDF output is governed
by [docs/EXCEL-REPORTS.md](docs/EXCEL-REPORTS.md) and must not be "improved" from this file.

---

## 1. Direction

**Ledger editorial** — the application should feel like the printed *Buku Kira-kira* it replaces:
quiet paper, serif headings, figures set in mono so columns line up, and edges that are drawn
rather than shadowed. Dense enough to work in all day, composed enough to show a committee.

**Signature move:** the A4 facsimile sheet. `.print-sheet` and `.report-sheet` reproduce the
original page — margins, ruling, signature block. It is the one place where the UI deliberately
stops looking like software, and it is the reason the interface uses three type roles instead of
one.

Three faces, three jobs:

| Role | Face | Used for |
| --- | --- | --- |
| Display | **Source Serif 4** 600 | page titles, panel titles, the wordmark, empty-state headings |
| Body | **Public Sans** 400/500/600 | every label, sentence, table cell, button |
| Figure | **IBM Plex Mono** 400/500 | money, counts, document numbers, column headers, codes |

Do not add a fourth face. Do not set body copy in the display face.

---

## 2. Colour

Colour lives in tokens. Two `:root` blocks exist in `app/globals.css` (an early palette and the
design-system palette from ~line 3025). **The later block wins.** Declare new colours there,
never as a raw hex inside a component rule, and never as an inline style. The v3 section near the
end of the file consumes tokens only.

### Light theme (roles)

| Token | Value | Role | Measured contrast |
| --- | --- | --- | --- |
| `--paper` | `#f4f6f4` | App background | — |
| `--surface` | `#ffffff` | Cards, tables, sheets | — |
| `--surface-soft` | `#eaf0ec` | Table header, zebra fills, quiet panels | — |
| `--surface-hover` | `#e4ece7` | Row and control hover | — |
| `--ink` | `#16211c` | Primary text | 16.56:1 on surface |
| `--muted` | `#4f5f57` | Secondary text, captions, column labels | 6.76:1 on surface, 5.85:1 on `--surface-soft` |
| `--line` | `#dce3de` | Hairlines and panel borders | — |
| `--accent` | `#14503c` | Primary action, active state, income | 7.98:1 on `--accent-soft` |
| `--amber` | `#7e5f1f` | Pending, voucher, outgoing | 5.18:1 on `--amber-soft` |
| `--blue` | `#255e7a` | Approved, informational | 6.15:1 on `--blue-soft` |
| `--red` | `#9c3a32` | Rejected, destructive | 5.80:1 on `--red-soft` |
| `--brass` | `#b08a46` | Expense bars and legends **only** — never text | non-text use |
| `--focus` | `#14503c` | Focus ring | 9.36:1 |
| `--sidebar-bg` | `#ffffff` | Sidebar ground (light theme) | — |
| `--sidebar-text` | `#3f4f47` | Sidebar labels | 8.68:1 on sidebar |
| `--sidebar-active` | `#e6efea` | Active nav item | ink 14.11:1 |

### Dark theme

| Token | Value | Role | Measured contrast |
| --- | --- | --- | --- |
| `--ink` | `#ecf2ed` | Primary text | 14.98:1 on `--surface` |
| `--muted` | `#a9bab0` | Secondary text | 8.37:1 on `--surface`, 7.58:1 on `--surface-soft` |
| `--accent` | `#a8dec0` | Primary action | 8.83:1 on `--accent-soft` |
| `--amber` / `--blue` / `--red` | `#e3c48c` / `#a6cbe0` / `#eba9a2` | Status roles | 7.87 / 7.61 / 7.01 on their soft fills |

### Contrast floor

- Body and helper text: **≥ 4.5:1** against its real background — not against white "by default".
  A caption on a pastel pill is measured against the pill.
- Icons, meaningful borders, focus rings: **≥ 3:1**.
- Never measure a `color:` token against white and conclude it passes. Check the block that
  paints the background, and remember the tinted surfaces (`.status-*`, `.type-tag`,
  `.count-pill`, `.metric-icon`) sit on pastel, not white.

---

## 3. Typography

- Self-hosted via `@fontsource`, pinned exactly in `package.json`: `public-sans`, `source-serif-4`,
  `ibm-plex-mono`. No webfont CDN, no second body face.
- Sizes: 27 / 20 / 17 / 16 / 14 / 13 / 12 / 11 / 10 / 9.5.
- Column headers (`th`), `.eyebrow` and `.nav-caption` are mono, uppercase, `letter-spacing: 0.1–0.12em`.
- **Floor: 11px** for every visible text on viewports ≤600px. The floor is enforced twice — base
  rules plus a `@media screen and (max-width: 600px)` override block that must stay at the **end**
  of `app/globals.css`. Moving it earlier makes later rules win and breaks the floor.
- Money is always `font-variant-numeric: tabular-nums` and right-aligned. Never centre currency.

---

## 4. Radius and spacing

Radii stay tokenised. Cards, panels, buttons and inputs use `--r-xs` (4px); chips and small
controls `--r-sm`; sheets and large surfaces `--r-2xl` (16px); avatars `--r-circle`. The only raw
radii left in the file are decorative geometry (`.metric-decoration`), print sheet corners and
2–3px micro radii on progress bars.

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `--r-xs` | 4px | `--s-1` | 4px |
| `--r-sm` | 6px | `--s-2` | 6px |
| `--r-md` | 8px | `--s-3` | 8px |
| `--r-lg` | 10px | `--s-4` | 10px |
| `--r-xl` | 12px | `--s-5` | 12px |
| `--r-2xl` | 16px | `--s-6` | 16px |
| `--r-circle` | 50% | `--s-7` | 20px |
| | | `--s-8` | 24px |
| | | `--s-9` | 32px |

Use the tokens for new `padding`, `margin` and `gap`. Legacy declarations with 13/15/17/19/22/23/25px
remain from the first implementation and are not a licence to add more.

---

## 5. Motion

- Exactly two keyframes exist: `pulse` (loading) and `spin` (progress). A third needs a reason.
- Durations 120–240ms, `ease` or `ease-out`. **No** bounce, elastic, spring or overshoot.
- **No** hover scale, no card lift, no micro-animation sprinkled across rows. Hover changes
  colour, background or border — never geometry.
- `prefers-reduced-motion: reduce` is honoured globally; keep that block.

---

## 6. Depth and layering

- Panels are drawn, not floated: 1px `--line` border, `box-shadow: none`.
- No coloured glow, no decorative blur.
- Hairline rules separate content; they are not decoration.
- `z-index` stays small and local (the file peaks at 100). No 999 stacking.

---

## 7. Responsive

Ten breakpoints: 1600 / 1350 / 1250 / 1100 / 1000 / 900 / 850 / 760 / 600 / 480px.
Below 900px the sidebar becomes a drawer; below 600px the topbar notification bell is
intentionally hidden and counts move into the drawer nav. Wide tables scroll inside
`.table-scroll` with edge shadows — never let the page itself scroll horizontally.
Details: [docs/UI-UX.md](docs/UI-UX.md).

---

## 8. Print and the A4 sheet

The A4 facsimile and every rule inside `@media print` are **frozen**. Page size, margins, ruling,
headings, signatories and the fund columns must match the four original Excel files exactly.
Screen-side v3 rules live inside `@media screen` for this reason. Do not restyle printed
documents as part of a screen redesign, and do not convert the sheet to a responsive layout.
`--brass` never appears in print.

---

## 9. Bans (the "slop" list)

Never add, even if a template suggests it:

- purple-on-white, violet→indigo gradients, or any gradient as brand expression;
- cream / sand / parchment backgrounds;
- near-black plus a single acid accent;
- hairline-everywhere with zero radius as a style;
- identical repeated card grids, fake `01 / 02 / 03` markers, nested cards;
- grey body text that fails 4.5:1;
- decorative blur or glow;
- a second body face, an icon font, or emoji as UI icons.

---

## 10. Verify before you ship

```bash
npx prettier --check .     # formatting
npx eslint .               # lint
npm test                   # 69 unit tests
```

Then the CI suites that cannot run locally (no browser in the sandbox):

- `tests/e2e/a11y.spec.ts` — axe, serious/critical must be zero. Muted helper text sits below that
  threshold, so **check contrast by calculation** whenever you touch a text colour.
- `tests/e2e/responsive.spec.ts` — layout at 1440 / 1024 / 390 / 360, plus the 11px phone floor.
- The Excel/PDF job — the four workbooks must stay byte-comparable to the reference set.
