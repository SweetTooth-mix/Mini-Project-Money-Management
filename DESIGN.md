# DESIGN.md — permanent design rules for Kira Rapi

This file is a contract, not a mood board. Every future change to the interface — human or
agent — must satisfy it. If a request conflicts with a rule here, stop and raise the conflict
instead of silently adding a new pattern.

Scope: `app/globals.css`, `app/**/page.tsx`, `components/**`. The Excel/PDF output is governed
by [docs/EXCEL-REPORTS.md](docs/EXCEL-REPORTS.md) and must not be "improved" from this file.

---

## 1. Direction

**Ledger editorial** — a calm, printed accounting book that happens to live in a browser.
Dense but quiet, green ink on cool paper, one accent used with intent.

**Signature move:** the A4 facsimile sheet. `.print-sheet` and `.report-sheet` reproduce the
original *Buku Kira-kira* page: margins, ruling, signature block. It is the one place where the
UI deliberately stops looking like software. Keep it.

What this direction is **not**: a SaaS dashboard template, a landing page, a fintech
"disruptor" brand, a design-system demo.

---

## 2. Colour

Colour lives in tokens. Two `:root` blocks exist in `app/globals.css` (an early palette and the
design-system palette from ~line 3025). **The later block wins.** Declare new colours there,
never as a raw hex inside a component rule, and never as an inline style.

### Light theme (roles)

| Token        | Value     | Role                          | Measured contrast |
| ------------ | --------- | ----------------------------- | ----------------- |
| `--paper`    | `#f3f5f4` | App background                | —                 |
| `--surface`  | `#ffffff` | Cards, tables, sheets         | —                 |
| `--surface-soft` | `#f7f9f8` | Zebra rows, subtle fills  | —                 |
| `--ink`      | `#172c2a` | Primary text                  | 14.68:1 on surface |
| `--muted`    | `#60716b` | Secondary text, table sublines, eyebrows | 5.16:1 on surface, 4.88:1 on `--surface-soft` |
| `--line`     | `#dce5df` | Hairlines, dividers           | —                 |
| `--accent`   | `#1c7458` | Primary action, active state  | 5.06:1 on `--accent-soft` |
| `--amber`    | `#87601c` | Pending / voucher / outgoing  | 5.07:1 on `--amber-soft` |
| `--blue`     | `#2c6585` | Approved / informational      | 5.61:1 on `--blue-soft` |
| `--red`      | `#ad3f3f` | Rejected / destructive        | 5.11:1 on `--red-soft` |
| `--focus`    | `#2d876a` | Focus ring                    | 4.39:1 (ring only needs ≥3:1) |
| `--sidebar-bg` | `#142f2b` | Sidebar ground              | —                 |
| `--sidebar-text` | `#b9ccc4` | Sidebar labels            | 8.49:1 on sidebar |

### Dark theme

| Token     | Value     | Role           | Measured contrast |
| --------- | --------- | -------------- | ----------------- |
| `--ink`   | `#edf4ef` | Primary text   | 15.7:1 on `--paper` |
| `--muted` | `#a6bbb0` | Secondary text | 7.6:1 on `--surface`, 6.84:1 on `--surface-soft` |

### Contrast floor

- Body and helper text: **≥ 4.5:1** against its real background (not against white "by default" —
  a 9px caption on a pastel pill needs the pill's own colour).
- Icons, borders that carry meaning, focus rings: **≥ 3:1**.
- Never measure a `color:` token against white and conclude it passes. Check the block that
  paints the background, and remember tinted surfaces (`.status-*`, `.type-tag`, `.count-pill`,
  `.metric-icon`) sit on pastel, not white.

### Fixed exceptions (measured, do not "tidy" these)

| Selector | Colour | Background | Ratio | Note |
| -------- | ------ | ---------- | ----- | ---- |
| `.avatar` | `#6a5537` | `#eadcca` | 5.25:1 | warm initials chip |
| `.metric-icon.gold` | `#8a6d2f` | `#f8f3e6` | 4.40:1 | icon, ≥3:1 required |
| `.metric-icon.orange` | `#9c6b2c` | `#fcf0e9` | 4.12:1 | icon, ≥3:1 required |
| `.note-spark` | `#6f8a4e` | `#f7f8f1` | 3.62:1 | decorative glyph |

---

## 3. Typography

- One family: **DM Sans** (self-hosted via `@fontsource`, weights 400/500/600/700).
  Do not introduce a second family; do not swap in Inter, Roboto, Arial, Helvetica or
  `system-ui` as the brand voice.
- Scale is fixed in px: 27 / 20 / 16 / 14 / 13 / 12 / 11 / 10 / 9.
- **Floor: 11px** for every visible text on viewports ≤600px. The floor is enforced twice —
  base rules plus a `@media screen and (max-width: 600px)` override block that must stay at
  the **end** of `app/globals.css`. Moving it earlier makes later rules win and breaks the floor.
- Numerals in money columns use tabular alignment; never centre-align currency.

---

## 4. Radius scale

Six steps. No ad-hoc radii in new work; the only raw values left in the file are decorative
geometry (`.metric-decoration`), print sheet corners and 2–3px micro radii on progress bars.

| Token        | Value | Use |
| ------------ | ----- | --- |
| `--r-xs`     | 4px   | tiny chips, inline tags |
| `--r-sm`     | 6px   | small controls, badges |
| `--r-md`     | 8px   | inputs, buttons, nav items |
| `--r-lg`     | 10px  | tiles, table wrappers |
| `--r-xl`     | 12px  | cards, panels (`--radius` = this) |
| `--r-2xl`    | 16px  | auth card, large surfaces |
| `--r-circle` | 50%   | avatars, icon discs |

---

## 5. Spacing scale

2px steps on a 4px rhythm. Use the tokens for new `padding`, `margin`, `gap`; legacy declarations
with 13/15/17/19/22/23/25px remain from the first implementation and are not a licence to add more.

| Token  | Value | Token  | Value |
| ------ | ----- | ------ | ----- |
| `--s-1` | 4px  | `--s-6` | 16px |
| `--s-2` | 6px  | `--s-7` | 20px |
| `--s-3` | 8px  | `--s-8` | 24px |
| `--s-4` | 10px | `--s-9` | 32px |
| `--s-5` | 12px |        |      |

---

## 6. Motion

- Exactly two keyframes exist: `pulse` (loading) and `spin` (progress). Adding a third needs a
  reason that survives review.
- Durations 120–240ms, `ease` or `ease-out`. **No** bounce, elastic, spring, or overshoot easing.
- **No** hover scale, no card lift on hover, no micro-animation sprinkled across rows. Hover
  changes colour, background or border — not geometry.
- `prefers-reduced-motion: reduce` is honoured globally; keep that block.

---

## 7. Depth, borders, layering

- Shadows are barely-there (`0 2px 4px #12392a03`). No coloured glow, no decorative blur.
- Hairline rules separate content; they are not decoration. Zero-radius "brutalist" styling is
  not the direction.
- `z-index` stays small and local (the file currently peaks at 100). No 999 stacking.

---

## 8. Responsive

Ten breakpoints: 1600 / 1350 / 1250 / 1100 / 1000 / 900 / 850 / 760 / 600 / 480px.
Below 900px the sidebar becomes a drawer; below 600px the topbar notification bell is
intentionally hidden and counts move into the drawer nav. Wide tables scroll inside
`.table-scroll` with edge shadows — never let the page itself scroll horizontally.
Details and screenshots: [docs/UI-UX.md](docs/UI-UX.md).

---

## 9. Print and the A4 sheet

The A4 facsimile and every print rule are **frozen**. Page size, margins, ruling, headings,
signatories and the fund columns must match the four original Excel files exactly. Do not
restyle printed documents as part of a screen redesign, and do not convert the sheet to a
responsive layout.

---

## 10. Bans (the "slop" list)

Never add, even if a template suggests it:

- purple-on-white, violet→indigo gradients, or any gradient as brand expression;
- cream / sand / parchment backgrounds;
- near-black plus a single acid accent;
- hairline-everywhere with zero radius as a style;
- identical repeated card grids, fake `01 / 02 / 03` markers, nested cards;
- grey body text that fails 4.5:1;
- decorative blur or glow;
- a second typeface, an icon font, or emoji as UI icons.

---

## 11. Verify before you ship

```bash
npx prettier --check .     # formatting
npx eslint .               # lint
npm test                   # 69 unit tests
```

Then the CI suites that cannot run locally (no browser in the sandbox):

- `tests/e2e/a11y.spec.ts` — axe, serious/critical must be zero. Muted helper text is a
  judgement call below that threshold, so **check contrast by calculation** when you touch
  a text colour.
- `tests/e2e/responsive.spec.ts` — layout at 1440 / 1024 / 390 / 360.
- `tests/e2e/*` print and report specs — must still produce byte-stable Excel/PDF output.
