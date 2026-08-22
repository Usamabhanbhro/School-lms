# School LMS — Design System

This document defines the visual and interaction design language for the School LMS. Any AI or developer working on the frontend should follow this spec exactly to keep the UI consistent across roles (Admin, Teacher, Student, Parent) and across desktop/mobile.

## Design Direction

Industrial, minimal, functional. This is a daily-use utility application (attendance, gradebooks, timetables) — not a marketing site. Clarity and consistency outrank decoration. No gradients, no soft shadows-as-decoration, no rounded/organic shapes.

## Color

| Token | Hex | Usage |
|---|---|---|
| `color-bg` | `#FFFFFF` | Base background |
| `color-text` | `#0F172A` | Primary text (near-black, not pure black) |
| `color-primary` | `#2563EB` | Buttons, active nav, links, focus rings |
| `color-success` | `#16A34A` | Present / Yes / positive status |
| `color-danger` | `#DC2626` | Absent / No / errors |
| `color-surface` | `#F1F5F9` | Card backgrounds, table row stripes, disabled states |
| `color-border` | `#E2E8F0` | 1px borders for elevation/separation |

**Rules:**
- Corners are square. `border-radius: 0` default, `2px` max if absolutely needed (e.g. checkboxes).
- Elevation via 1px borders, not shadows. If a shadow is used, keep it flat/subtle (`0 1px 2px rgba(0,0,0,0.05)`), never a soft glow.
- Status must never rely on color alone — pair green/red with an icon or shape (check/X, filled/outline dot) for accessibility.

## Typography

Single sans-serif family throughout: **Inter** or **IBM Plex Sans**. Hierarchy is built with weight and size, not multiple typefaces.

| Role | Weight | Size (approx) |
|---|---|---|
| Page title | 700 | 24–28px |
| Section header | 600 | 18–20px |
| Body | 400 | 14–16px |
| Caption/meta | 400 | 12–13px |

- All numeric columns (grades, IDs, dates, roll numbers) use **tabular figures** (`font-variant-numeric: tabular-nums`) so columns align.
- No serif fonts anywhere.

## Spacing

Strict 8px scale: `4, 8, 16, 24, 32, 48, 64`. No arbitrary spacing values. This is what makes a square/minimal design read as intentional rather than accidental.

## Icons

One icon library only: **Lucide** (thin stroke, geometric, pairs with the square/minimal aesthetic). Never mix icon sets.

## Motion

- Opens (dropdowns, sidebars, modals): `150–200ms ease-out`
- Closes: `100–150ms ease-in`
- Consistent timing function across the entire app — this consistency matters more than the specific values.
- Respect `prefers-reduced-motion`.

**Applied timing patterns:**

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Mobile drawer open | `translateX(100%)` → `translateX(0)` | 200ms | ease-out |
| Mobile drawer close | `translateX(0)` → `translateX(100%)` | 150ms | ease-in |
| Drawer scrim | `opacity 0` → `1` | 150ms | ease-out |
| Confirm dialog overlay | `opacity 0` → `1` | 150ms | ease-out |
| Confirm dialog card | `scale(0.95) translateY(4px)` → `scale(1) translateY(0)` | 200ms | ease-out |
| User menu dropdown | `opacity 0 translateY(-4px)` → `opacity 1 translateY(0)` | 150ms | ease-out |
| Dashboard mount (sign-in transition) | `opacity 0 translateY(8px)` → `opacity 1 translateY(0)` | 200ms | ease-out |
| Toast progress bar | `scaleX(1)` → `scaleX(0)` | 4000ms | linear |

All animations respect `prefers-reduced-motion` via the global CSS rule that sets `animation-duration: 0.01ms` when reduced motion is preferred.

## Layout

- **Sidebar**: persistent, left-aligned.
  - Masthead: school logo, top of sidebar, tasteful sizing (not oversized/hero-style).
  - Nav below masthead, styled like binder-tab dividers, role-aware (nav items differ per role: Admin/Teacher/Student/Parent).
  - Footer of sidebar (or app footer): "Developed by Usama Bhanbhro" — small, muted text, not competing with content.
- **Content area**: card/table hybrid, ruled-table style with hairline dividers (ledger/roll-call feel), consistent with the industrial direction.

## Tables

Two density modes, controlled by a `density` prop on the `<Table>` element:
- **Compact** (`density="compact"`, default) — admin desktop views (attendance registers, gradebooks with many rows). `px-3 py-1.5` cell padding.
- **Comfortable** (`density="comfortable"`) — teacher mobile views (larger tap targets for marking attendance on a phone). `px-4 py-3` cell padding.

Density cascades to all `th` and `td` descendants via Tailwind's child selector (`[*:where(th,td)]`).

## Status & Feedback

- **Toasts**: square, left accent bar (blue/green/red by type), top-right or bottom-right, auto-dismiss with a visible CSS-animated progress bar that drains from 100% to 0% over 4 seconds. Dismiss button (X icon) on the right. Icon: `CheckCircle2` for success, `XCircle` for error.
- **Confirm dialogs**: shared `ConfirmDialog` component with icon, title, description, and action buttons. Do not hand-roll inline confirmation modals — use the shared component for all destructive or irreversible actions.
- **Empty states**: plain and instructional, no illustrations. State what's missing + a clear primary action (e.g. "No students enrolled in this class yet" + "Add student" button).
- **Errors**: interface voice, not personified. State what happened and how to fix it. Never vague, never apologetic.

### Status indicators
Status must **never** rely on color alone — pair color with a shape or icon:

| Status | Icon | Color |
|---|---|---|
| Present | `CheckCircle2` | success |
| Absent | `XCircle` | danger |
| Leave | `Minus` | primary |
| Locked | `Lock` | success |
| Unlocked / Draft | `Unlock` | neutral |

This applies to attendance status buttons, status display badges, and any other visible state indicator.

## Loading States

- Skeletons must match the shape of the real content (table skeleton for tables, card skeleton for cards) — never generic grey bars unrelated to layout.
- Skeleton → content transition should not cause layout shift.

## Print

Dedicated print stylesheet required for: report cards, attendance sheets, exam schedules. Plan this alongside screen styles, not as a retrofit.

## Signature Interaction

The **roll-call tick**: attendance marking uses a distinct check-mark "stamp" interaction (quick, deliberate motion) rather than a generic checkbox toggle. This is the one place the app spends visual personality — everywhere else stays quiet and disciplined.

## Accessibility Baseline

- Visible keyboard focus states on all interactive elements (use `color-primary` for focus rings).
- Color + shape/icon for all status indicators.
- Respect `prefers-reduced-motion`.
- Responsive down to mobile (teacher attendance flow is a primary mobile use case).

## Component Notes for Implementation

- Tailwind CSS v4 is the styling approach (see ARCHITECTURE.md). Map the tokens above 1:1 into the CSS-first `@theme` block in `src/app/globals.css` (colors, spacing, fontFamily) rather than using arbitrary values in components. There is no `tailwind.config.ts` (see CONVENTIONS.md) — do not add one.
- Use `impeccable` and `ui-ux-pro-max` skills (if available to the AI working on this) for UI/UX pattern decisions — layout hierarchy, form patterns, accessibility, responsive behavior — while keeping all visual tokens (color/type/spacing/motion) consistent with this document.
