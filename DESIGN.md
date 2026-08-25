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
| Global search (mobile full-screen) | `opacity 0 translateY(8px)` → `opacity 1 translateY(0)` | 200ms | ease-out |
| Global search (desktop dialog) | `scale(0.95) translateY(4px)` → `scale(1) translateY(0)` | 200ms | ease-out |
| Skeleton shimmer sweep | `background-position: -200%` → `200%` | 1600ms | ease-in-out (infinite) |
| Toast slide-in | `translateX(100%) opacity 0` → `translateX(0) opacity 1` | 200ms | ease-out |
| Status badge change flash | `background-color: primary 15%` → `transparent` | 400ms | ease-out |
| Collapsible panel open | `scale(0.95) translateY(4px)` → `scale(1) translateY(0)` | 200ms | ease-out |

All animations respect `prefers-reduced-motion` via the global CSS rule that sets `animation-duration: 0.01ms` when reduced motion is preferred.

## Motion Patterns

### Skeleton shimmer

Loading skeletons use a left-to-right shimmer sweep (`shimmer` keyframe, 1600ms loop) rather than a generic opacity pulse. The shimmer is a subtle semi-transparent gradient that moves across the skeleton shape. Skeletons must always match the shape of the real content they replace (table rows for tables, card blocks for cards).

### Status change flash

When a status badge changes value (e.g. attendance marking Present/Absent/Leave, or auto-Late derivation), apply a brief flash animation (`status-flash`, 400ms ease-out) to acknowledge the change. The badge's `key` prop should include the status value so React re-renders the element and replays the animation on each change. This is applied at the call site, not on the generic Badge component.

### Panel/collapsible transitions

Panels that toggle visibility (e.g. monthly attendance totals) use `dialog-scale-in` (200ms ease-out) when opening, matching the same timing family as modals and dialogs.

## Overlay Patterns

### Full-screen takeover (mobile)

On narrow viewports (`< md`), overlays that require user input should **replace the current view entirely** — no scrim, no floating box, no competing z-index layers. Structure:

- `fixed inset-0 z-50 flex flex-col bg-bg` — fills the full screen with the app background
- Pinned header bar at top (search input + back/close action)
- Scrollable content area fills remaining space via `flex-1 overflow-y-auto`
- Slide-in animation: `global-search-slide-in` (200ms ease-out, `translateY(8px)` → `translateY(0)`)

This eliminates sidebar-drawer overlap entirely — there's no competing layered UI.

### Centered overlay dialog (desktop)

On wider viewports (`md+`), use a semi-transparent backdrop + centered fixed-width panel:

- Backdrop: `fixed inset-0 z-50 bg-black/30` with `overlay-fade-in` (150ms)
- Panel: `max-w-2xl` centered with `dialog-scale-in` (200ms ease-out)
- Dismiss on backdrop click or Escape key

### Empty state sizing

Pre-search and empty-result states must **shrink to fit their content** — no fixed minimum heights or excessive padding. Use `py-4` for compact hint states, not `py-8` which creates a large blank box.

## Layout

- **Sidebar**: persistent, left-aligned.
  - Masthead: school logo, top of sidebar, tasteful sizing (not oversized/hero-style).
  - Nav below masthead, styled like binder-tab dividers, role-aware (nav items differ per role: Admin/Teacher/Academics).
  - Footer of sidebar (or app footer): "Developed by Usama Bhanbhro" — small, muted text, not competing with content.

### Responsive Logo Sizing

The school logo must be legible and proportionate across all viewports. The following sizing rules apply to both the sidebar masthead and the mobile header:

| Context | Container | Logo | Notes |
|---|---|---|---|
| **Sidebar (desktop)** | `size-16` (64×64) | `size-14` (56×56) | `object-contain` preserves aspect ratio. `overflow-hidden` on container prevents overflow from tall crests. |
| **Mobile header** | `size-12` (48×48) | `size-10` (40×40) | Same `object-contain` + `overflow-hidden` pattern. |
| **Sign-in screen** | `size-16` (64×64) | `size-14` (56×56) | Larger, centered. `overflow-hidden` too, so tall crests never bleed. |

**Aspect ratio rule:** Always use `object-contain` on the `<img>` element. Never use `object-cover` or fixed aspect ratios — the logo container is square, and `object-contain` ensures a tall crest/seal or a wide horizontal logo both display correctly without cropping. The `overflow-hidden` on the square container prevents any visual bleed from odd-shaped logos.

**Spacing:** The masthead container uses `gap-3` (12px) spacing between logo and school name text, within the standard 8px spacing scale.
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
| Late | `Clock` | orange (use `text-orange-600` / `border-orange-300 bg-orange-50`) |
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
