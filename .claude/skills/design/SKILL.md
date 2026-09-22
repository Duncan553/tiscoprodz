---
name: design
description: TISCOPRODZ's visual system — the red palette, type pairing, spacing rhythm, and how each surface (hero slide, card, list row, form, empty state) is styled. Load before changing any styling, adding a page, or touching colour, font, or spacing.
---

# Visual system for TISCOPRODZ

**The site is red.** Deep oxblood red everywhere, white type on top, one warm
amber accent lifted from the iPod screen in the reference art. That single
decision is the brand — do not dilute it with a neutral dark theme.

A one-colour site goes flat for four specific reasons. Every rule below aims at
one of them.

1. **One flat red.** No surface layering, so nothing reads as near or far.
2. **One font doing every job.** Headlines and UI at the same optical weight —
   nothing has a voice.
3. **Muddy text.** Pinkish grey on red reads as "disabled", not "secondary".
4. **No texture.** A perfectly clean flat red looks like an unstyled div.

## Colour

The page is **not `#ff0000`**. Pure red is unreadable at full-page scale and
leaves no room to layer. The scale below is a deep oxblood that gets lighter as
surfaces come forward.

```css
--surface-0: #2b060b;   /* page — deepest */
--surface-1: #3d0910;   /* cards, header, list rows */
--surface-2: #520d16;   /* raised: hover, active row, drawer */
--surface-3: #6b1220;   /* the brightest red, used sparingly */
--line:      #6e1a26;   /* borders — never white at low alpha */
--line-2:    #8a2430;   /* inputs and interactive edges */

--text-1: #fffaf8;      /* headings, primary — essentially white */
--text-2: #f0cfcf;      /* body — warm, still clearly readable */
--text-3: #c99a9a;      /* meta, captions */
--text-4: #a97878;      /* placeholders, disabled */

--accent:      #d98a12; /* amber, from the iPod screen in the reference */
--accent-hot:  #f0ad3c; /* lighter amber — accent TEXT on red */
--accent-soft: rgb(217 138 18 / 0.14);
```

**Contrast rule:** the base amber on deep red is fine for fills with dark text
on top; use `--accent-hot` whenever the amber is TEXT.

**Ratio:** roughly 90% red surfaces + white type, 10% amber. Amber marks the one
thing you want tapped on a screen. A second amber button halves the first.

**Never introduce a third hue.** No blue links, no green success, no purple.
Errors use `--text-1` on `--surface-3` with an amber rule — a red error message
on a red page is invisible, and a red-and-green page is a different site.

## Type

**Two faces, two jobs. Never one.**

| Role | Face | Use |
|---|---|---|
| Display | **Playfair Display** (700–900, italic available) | the wordmark, hero slide titles, h1/h2, prices |
| Text / UI | **Inter** | body, labels, buttons, fields, nav, everything else |

The reference is an editorial fashion layout — a high-contrast serif over
photography is the whole look. Playfair carries that; Inter stays for UI
because character hurts at 13px.

**Tracking:** display gets `-0.02em` and, for the wide eyebrow labels above a
hero title, `+0.35em` uppercase at small size — the "T H E   L I T T L E" line
in the reference. UI text stays at 0.

**Scale** — fluid, no breakpoints:

```css
--text-hero: clamp(3rem, 12vw, 8rem);   /* the slide title, one per slide */
--text-h1:   clamp(2rem, 5vw, 3.25rem);
--text-h2:   clamp(1.5rem, 3vw, 2rem);
--text-body: 1.0625rem;   /* 17px — 16px is the floor, not the target */
```

**Measure:** body caps at `62ch`. **Line height:** 1.6 body, 1.02–1.1 display.
Tight display leading is most of what makes a headline look designed.

## Depth and texture

- **Grain.** ~4% SVG noise across the page, `pointer-events: none`. On a flat
  red this matters more than it did on black — it is the difference between
  "oxblood" and "unstyled div".
- **Vignette.** A soft dark radial at the edges of the hero, so the artwork sits
  in the page instead of on it. The reference photo does exactly this.
- **Elevation** is surface colour + border, never a big shadow. On red a shadow
  reads as dirt; a lighter red reads as closer.

## How each part is handled

| Part | Rules |
|---|---|
| **Hero slide** | Wide-tracked eyebrow, one `--text-hero` display title, the artwork plate overlapping it, slide counter `*01` bottom-right with prev/next arrows. Three slides, no more. |
| **Slide counter** | Display face, `*` prefix, two digits. Current slide in `--text-1`, the total in `--text-3`. |
| **Section head** | `--text-h2` display + a `--text-3` one-liner under it. Always says what the section IS. |
| **Card** | `--surface-1`, 1px `--line`, `rounded-2xl`, hover to `--surface-2`. Cover art square, `object-cover`, never distorted. |
| **List row** | Compact, `--surface-1`, fixed columns so BPM/key/price align down the page. Price in the display face — it is what people scan for. |
| **Price** | Display face, tabular numerals. USD is the price; the KSh equivalent sits below in `--text-3` at 11px. |
| **Button** | Primary: solid `--accent`, near-black text, `--dur-1` transition, press to 0.97. Ghost: `--surface-2`, `--text-1`. One primary per screen. |
| **Form field** | `--surface-0` inside a `--surface-1` card, 1px `--line-2`, focus border `--accent`. Label above in uppercase `--text-3`, never a placeholder as the label. |
| **Empty state** | Never a bare sentence. A line saying what goes here + the action that fills it. |
| **Loading** | Skeletons shaped like the real content in `--surface-1`. Never a centred spinner on a full page. |

## Spacing

8px base. Section padding `py-16` mobile, `py-24` desktop — dull sites are
usually *cramped*, not empty. Related items 8–12px apart, unrelated groups 32px+.
Proximity does more for hierarchy than any border.

## Artwork

The hero art is **drawn in SVG in this repo**, not a downloaded photograph. It
is ours, it scales to any screen, and it costs a few KB instead of a 400KB JPEG
on Kenyan mobile data. If a real photo replaces it later, keep it desaturated so
the red stays the loudest thing on the page.

## The token-pair rule

A background token and its text token travel together. `--accent` pairs with
`--on-accent`. Writing `background: var(--accent)` beside a hardcoded `#fff` is
how a white count ended up on a white badge when the palette changed. If the
surface is a variable, the text on it must be one too.

## Related

- `.claude/skills/ui-ux/SKILL.md` — hierarchy, contrast floors, the review
  checklist. This file says what the colours ARE; that one says how to arrange
  them so nothing overpowers and nothing hides.
- `.claude/skills/motion/SKILL.md` — surface and motion are one system. A
  beautiful slide that jerks into place is still cheap.
