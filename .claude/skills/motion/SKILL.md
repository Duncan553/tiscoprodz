---
name: motion
description: TISCOPRODZ's motion system built on Motion (Framer Motion) v13 — durations, easings, the slide transition, variants, and the rules that keep it fast. Load before adding or changing any animation, transition, hover state, page entrance, slider, or loading state in this repo.
---

# Motion for TISCOPRODZ

The library is **`motion`** (npm `motion@13`, the current name for Framer
Motion). Import from `motion/react`:

```tsx
"use client";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
```

`framer-motion` is the same package under the old name. **Use `motion/react`**
so there is one import path in the repo.

Every component that imports it needs `"use client"` — the animation runs in the
browser. Keep those components small and leaf-level so a slider does not drag a
whole page out of server rendering.

The site is a record store. It should feel like flipping through crates — quick,
physical — not like a corporate page fading paragraphs in as you scroll. Two
failure modes, and they are opposites:

- **Slop:** everything animates, elements slide in from random directions.
- **Slow:** tasteful but 600ms, so every interaction has a wait built in.

## The numbers

| What | Duration | Token |
|---|---|---|
| Hover, focus, colour, press | 120ms | `--dur-1` |
| Small element in/out (chip, badge) | 180ms | `--dur-2` |
| Drawer, sheet, overlay | 260ms | `--dur-3` |
| **Hero slide change** | 620ms | `--dur-slide` |

`--dur-slide` is the ONE exception to "nothing over 320ms". A full-bleed hero
crossfade is a scene change, not a UI response — at 300ms it reads as a glitch.
Nothing else in the repo may borrow it.

**Exits run at two-thirds of the entrance.** Waiting for something to leave is
pure dead time; nobody wished a menu took longer to close.

## The curves

```ts
export const EASE_OUT  = [0.16, 1, 0.3, 1] as const;   // appearing
export const EASE_IN   = [0.4, 0, 1, 1] as const;      // leaving
export const EASE_MOVE = [0.65, 0, 0.35, 1] as const;  // A -> B on screen
```

Never `linear` for anything a person looks at — only mechanical motion (a
spinning disc, a progress bar).

**Springs:** use `{ type: "spring", stiffness: 320, damping: 32 }` for drags and
the press feedback. Do NOT spring a full-page transition; springs have no fixed
duration and a slow one makes the whole site feel loose.

## The two properties

**Animate `transform` and `opacity`. Nothing else.** They are the only
properties the compositor can handle alone. `width`, `height`, `top`, `left`,
`margin` force layout on every frame, and 16.7ms disappears fast when the page
reflows 60 times a second.

- Growing a bar → `scaleX`, not `width`
- Sliding a panel → `x` / `y`, not `left`
- Revealing → `opacity` + `y`, not `height`

Motion's `x`/`y`/`scale` props already compile to `transform`. If you find
yourself animating `height`, use `layout` instead and let Motion do the FLIP.

## Distance

Entrances travel **8–24px**. The eye tracks distance, not milliseconds, so a
long slide reads as slow at the same duration. Big travel is only for something
that genuinely comes from off-screen.

## Patterns this repo uses

**Variants, not inline props.** A named variant object keeps the numbers in one
place and lets a parent orchestrate its children:

```tsx
const list = {
  show: { transition: { staggerChildren: 0.04 } },   // 40ms, see below
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } },
};
```

**Stagger 40ms, capped at ~8 items.** Past 320ms total the last row is visibly
waiting on the first. For a long catalogue, stagger the first eight and let the
rest appear with them — or skip the stagger entirely.

**`AnimatePresence` needs a `key`.** The hero slider swaps on
`key={slideIndex}`; without a changing key the exit animation never runs. Use
`mode="wait"` only when the outgoing element must finish first — for a crossfade
you want the default, both on screen at once.

**Scroll reveal fires ONCE.** `whileInView` with `viewport={{ once: true }}`.
Re-animating on scroll-back is the single most common "AI website" tell.

## Ambient motion (motion that runs by itself)

Everything above is REACTIVE motion: it answers something a person did. Ambient
motion is different — it runs on its own, forever, with no input. The hero drift
is the only ambient motion in this repo, and it has its own rules because the
failure modes are not the same.

Reactive motion fails by being slow. **Ambient motion fails by being noticed.**
If someone can watch it, it is too fast, too big, or too regular.

### The four numbers

| Property | Ambient | Why |
|---|---|---|
| Duration | **9–20s per cycle** | Under ~6s it reads as a pulse and pulls the eye. Ambient motion should be slower than anything a person would do. |
| Amplitude | **6–28px** | Past ~30px the layer visibly leaves its position and the composition breaks. |
| Easing | `easeInOut` | Linear reads mechanical — a machine, not a drift. Ambient motion has to feel like it has weight. |
| Repeat | `repeatType: "mirror"` | `"loop"` snaps back to the start at the end of every cycle, which is a visible jump. Mirror reverses instead, so the motion never restarts. |

### Never let the layers sync

This is the rule that makes the difference between "alive" and "a slideshow
wobbling". Give every layer a DIFFERENT period, and make those periods share no
small factors:

```ts
// 11s, 14s, 17s, 9s — they drift in and out of phase and never line up.
// 10s / 20s / 30s would re-sync every 30 seconds and read as one pulse.
const PERIODS = [11, 14, 17, 9];
```

Offset the starting phase too (`delay: -3`, a NEGATIVE delay, starts a loop
already part-way through), or every layer begins at the same extreme on page
load and the first cycle looks choreographed.

### Give each layer its own axis

Layers that all drift left-right look like the page is sliding. Vary it: one
moves on x, one on y, one rotates by a fraction of a degree, one breathes on
scale between 1 and 1.02. Different axes at different periods is what produces
motion with no discernible pattern.

### Stop it when nobody is looking

An animation running off-screen costs battery and CPU for nothing. Gate ambient
loops on `useInView(ref, { once: false })` and let them idle when the hero has
scrolled away.

### Reduced motion

Autonomous, continuous, unprompted movement is precisely what
`prefers-reduced-motion` exists to suppress — this is not the borderline case
that a pointer-driven effect is. Cut the amplitude hard (to roughly a quarter)
rather than removing it outright, and never let a reduced-motion cycle run
faster than the full one.

### What ambient motion is NOT

- **Not pointer-following.** A layer that tracks the cursor is reactive, and it
  stops the moment someone lifts their hand — which makes a page feel dead on
  touch devices, where there is no cursor at all.
- **Not scroll-driven alone.** Scroll parallax only moves while someone scrolls.
  It composes well WITH ambient drift, but on its own a still page is a still
  page.
- **Not a carousel.** Slides advancing is content changing, not atmosphere.

## Slide transitions and swipe

A carousel is judged almost entirely on how the change feels. Two things make it
good, and both are usually missing.

### The layers must not move as one

If the media, the headline and the button all travel the same distance at the
same time, the slide reads as one flat card sliding past. Move them at
**different distances** — the background least, the headline most — and the
change reads as depth. Roughly:

| Layer | Travel |
|---|---|
| Background media | 8–12% of the width, plus a small scale (1.06 → 1) |
| Headline | 40–60px |
| Supporting text / action | 24–32px, entering slightly later |

A **stagger of 40–60ms** between the text layers is what turns a transition into
a sequence. Any more and it reads as lag.

Use `mode="wait"` for a big headline (two of them cross-fading through each other
is illegible) and the default overlap for the background (a gap between two
backgrounds is a flash of empty page).

### Swipe is velocity, not distance

The common mistake is committing on distance alone — "dragged more than half the
width". Real gestures are flicks: a fast, short swipe is a deliberate change, and
a slow drag most of the way across is someone who changed their mind.

**Commit on either threshold:**

```ts
const power = offset.x + velocity.x * 0.35;   // px + px/s, weighted
if (power < -8000 || offset.x < -120) next();
else if (power > 8000 || offset.x > 120) prev();
else snapBack();
```

Other rules that separate a good swipe from a bad one:

- **`dragElastic` around 0.15.** Zero feels nailed down; 1 feels broken.
- **`touch-action: pan-y` on the draggable element**, or the carousel eats
  vertical scrolling and the page traps the reader.
- **Lock the axis** (`dragDirectionLock`) so a slightly diagonal swipe resolves
  to one direction instead of wobbling.
- **Follow the finger during the drag.** A slide that only moves once you let go
  feels like a button, not a swipe.
- **Kill autoplay on first interaction** — they have taken over.
- **Keyboard too.** Left/right arrows when the carousel has focus; a swipe-only
  control is unusable without a touchscreen.

### Direction has to be carried

The exiting slide must leave on the side the new one came from. Track the
direction of the change and pass it into the variants (Motion's `custom` prop) —
without it, every slide exits the same way and going backwards looks wrong.

## Animating words (text motion)

Type is the loudest thing on the page, so moving it is the highest-risk motion
there is. Done right it reads as expensive. Done wrong it reads as broken, and it
delays reading — the one thing a visitor came to do.

### Split by WORD, not by letter

Per-letter is the effect everyone reaches for first and it is almost always
wrong here:

- A 6-word headline is 6 nodes. The same line per-letter is ~40, each with its
  own transform. On a mid-range Android that is a measurable frame cost for an
  effect nobody consciously notices.
- Letters landing one at a time reads as a *typewriter* — a machine spelling a
  word. Words landing one at a time reads as a *voice*. This site sells beats;
  the voice is the right register.
- Letters break kerning. Each letter becomes its own inline-block, so the pair
  kerning between them is dropped and the word visibly loosens.

Per-letter is reserved for one or two words maximum (a wordmark), never a
sentence.

### The mask reveal is the one worth having

Two nested elements per word:

```
<span class="split__word">      /* overflow: hidden — the mask, the slot   */
  <span class="split__inner">   /* translateY(100%) → 0 — the word itself  */
```

The word slides up out of a slot it was always hiding inside. It is the
typographic reveal every luxury site uses, and it costs one transform per word
with no opacity fade needed — the mask does the hiding.

The mask must be `overflow: hidden` on an `inline-block`, and the wrapper needs
enough vertical room or the mask clips the descenders of g, y and p permanently.
Give it `padding-bottom` and pull it back with a matching negative margin.

### The stagger numbers

- **Words: 55ms apart.** Under ~35ms they arrive as one blur and the stagger is
  wasted work. Over ~90ms the sentence takes longer to finish than it takes to
  read, which is the point where animation becomes an obstacle.
- **Duration per word: 0.7s**, on `[0.16, 1, 0.3, 1]` — slow out, hard stop.
- **Total budget: under 1.2s** for a headline. `words * 0.055 + 0.7` — so a
  9-word headline is already at the ceiling. Longer headline, tighter stagger.
- **Distance: 100%** (the word's own height) for a mask reveal, not a pixel
  value. Pixels are wrong at a different font size; `100%` is always exactly one
  slot.

### Accessibility: this is where split text usually breaks

Splitting a sentence into spans destroys it for a screen reader, which will
announce the pieces as fragments. The fix is two attributes, and they are not
optional:

- `aria-label` on the CONTAINER, holding the original unsplit string.
- `aria-hidden="true"` on every generated piece.

The reader then announces the whole sentence and ignores the spans entirely. Set
the label from the source string, never by reading the DOM back — the DOM is the
thing you just broke.

`prefers-reduced-motion`: do not translate at all. Vestibular triggers are about
movement, and a headline sliding is movement. Fade the whole line as one, or
just show it. Never stagger under reduced motion — a stagger IS the movement.

### Never animate body text

Headlines, a price, a single stat — those can move. A paragraph must not. The
reader is trying to read it and the words are not there yet; you have made your
own copy unreadable to look clever. Same rule for anything behind a click: a
form label, an error message, a button. Those appear instantly.

### The font trap

Splitting before the webfont loads measures the FALLBACK font. The words get
positioned at Times New Roman metrics, then the real font swaps in and every
word jumps mid-animation. Gate on `document.fonts.ready` — or, better, don't
measure at all: the mask reveal here uses `100%` and CSS flow, so it never reads
a width and cannot be caught by this. Anything that measures pixels must wait.

### Scroll-linked vs trigger

A headline should fire ONCE when it enters view (`useInView`, `once: true`), not
track scroll. Scroll-linked text that un-reveals when you scroll back up looks
like a rendering bug. Reserve scroll-linked progress for the footer curtain and
for long-form emphasis, never for a heading.

## Pop, and why tap feedback is not decoration

A phone has no hover state. On a desktop, the moment you put the cursor on a
link the colour shifts and you know the thing is live. On a phone there is
nothing between the tap and the next page painting — and on a slow connection
that gap is a second or more of silence, which is exactly where people tap a
second time. A double-submitted form, a doubled cart line.

So `whileTap` is not a flourish. It is the only confirmation a touch device
gets:

```tsx
whileTap={{ scale: 0.94 }}
```

Numbers that work:
- **0.94** for a nav link or a button. 0.98 is invisible, 0.9 makes the layout
  look like it flinched.
- A **spring, not a duration** — `stiffness: 400, damping: 17`. The slight
  overshoot on release is what reads as "pop". A tween reads as "fade".
- Kill `-webkit-tap-highlight-color` when you add this. Otherwise the grey iOS
  flash fires as well and the two fight.

Mount pop vs press pop are different jobs and should be tuned separately: the
mount stagger is decoration and runs once (damping 24, soft), the press is
feedback and must feel instant (damping 17, springy).

### The travelling active bar

An active-route underline should MOVE between links, not cross-fade. One shared
`layoutId` on every instance is the whole implementation — Motion then treats
them as one element changing position and animates the gap:

```tsx
{active && <motion.span layoutId="nav-active" className="nav-link__bar" />}
```

It only works while every instance shares the id, and it needs a positioned
ancestor on the link or the bar animates against the page instead.

## Rules that keep it honest

1. **Motion must mean something** — where a thing came from, that a tap
   registered, that new content arrived. Decoration is slop.
2. **Never block input.** A link tapped mid-animation must work.
3. **Never animate the thing they're reading.** Animate containers, not
   paragraphs.
4. **Respect reduced motion.** `globals.css` collapses CSS transitions, but
   **Motion's JS animations ignore CSS**. Every animated component must call
   `useReducedMotion()` and drop to an opacity-only or instant variant. This is
   the one thing that regresses every time someone adds a new animation.
5. **Autoplay pauses on interaction.** The hero advances itself; the moment
   someone hovers, focuses an arrow or drags, it stops and stays stopped.
6. **Loading is not motion.** A pulsing skeleton is fine; a bouncing spinner is
   noise.

## What's already built

`src/lib/motion.ts` exports `EASE_OUT`, `EASE_IN`, `EASE_MOVE`, and the shared
`rise` / `stagger` variants.

`src/components/hero/Drift.tsx` is the ambient engine: per-layer periods, mirror
repeat, negative phase offsets and the off-screen gate.
`src/components/hero/HeroSlider.tsx` composes it with the slide transition, the
counter and the autoplay pause.

Reach for those before writing a new keyframe. A new animation needs a reason
none of them cover.
