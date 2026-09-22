---
name: ui-ux
description: What good UI/UX actually looks like — hierarchy, contrast, balance and legibility, so no element overpowers another and nothing on the page is hard to see. Load before designing or reviewing ANY screen, and whenever something "looks off" but it is not obvious why.
---

# UI/UX: hierarchy, contrast, balance

`design` says what the colours and fonts ARE. This says how to arrange them so a
screen reads. Load both.

The two failures this exists to prevent:

- **Overpowering.** Everything shouts, so nothing is heard. Four bold headings,
  three primary buttons, a full-bleed image fighting the title.
- **Invisibility.** Something important can't be seen — text too dim, a control
  the same colour as its background, a count in white on a white pill.

They are the same bug wearing different clothes: **no hierarchy.**

---

## 1. One loudest thing per screen

Rank every screen before building it:

| Level | How many | What it is |
|---|---|---|
| **Primary** | exactly 1 | the reason the screen exists — the hero title, the price, the Pay button |
| **Secondary** | 2–4 | supports the decision — the sub-line, the licence options, the artwork |
| **Tertiary** | the rest | meta, labels, counts, captions, legal |

**One primary. Not two.** A second primary button doesn't double the call to
action, it halves the first. If two things both feel essential, the screen is
doing two jobs — split it.

### The squint test
Squint until the screen blurs. You should see **one** dark/bright mass first,
then a couple of shapes, then grey texture. If three things fight at the same
weight, demote two.

### The 3-second test
Cover everything and reveal for three seconds. Can you say what the screen is
for and what to do next? If not, the primary isn't loud enough — or it's loud
but surrounded by competitors.

---

## 2. Contrast: the rules that are not opinions

**Text must clear these ratios.** They are legal accessibility floors in many
places, and below them people genuinely cannot read:

| Element | Minimum |
|---|---|
| Body text | **4.5:1** |
| Large text (≥24px, or ≥19px bold) | **3:1** |
| Icons, borders, focus rings, form outlines | **3:1** |

Check with a contrast checker, not by eye — a saturated background fools you
every time. On this site's red (`#ee0600`) white is ~4.0:1, which is why body
copy uses pure `--text-1` at size and `--text-2` only for short supporting lines,
never long paragraphs.

### The token-pair rule

**A background token and its text token travel together.** This repo pairs
`--accent` (white) with `--on-accent` (red). Writing `background: var(--accent)`
and `color: #fff` is how the cart badge became a white number on a white pill —
the palette changed underneath a hardcoded colour and nothing failed loudly.

> **Never hardcode a colour next to a token.** If the surface is a variable, the
> text on it must be a variable too.

### Grey is not "secondary" on a coloured ground
Grey text on red goes muddy pink and reads as *disabled*. Secondary text is
**tinted white** (`--text-2`), not desaturated.

---

## 3. Everything must be seen

Walk this list before calling a screen done:

- [ ] **Every control is visible without hovering.** Hover-only affordances do
      not exist on a phone.
- [ ] **Focus is visible.** Tab through the whole screen. A keyboard user who
      can't see where they are is locked out.
- [ ] **Tap targets are ≥44×44px**, with ≥8px between adjacent ones.
- [ ] **Nothing important is below the fold on a 360px phone** — the primary
      action especially.
- [ ] **Nothing is hidden behind fixed furniture.** The audio player is fixed to
      the bottom; that is why `<body>` carries `pb-28`.
- [ ] **Icon-only buttons have `aria-label`.** A bare `<svg>` is silent.
- [ ] **State changes are announced** (`aria-live`) — a slide counter, a search
      result count, a payment status.
- [ ] **Disabled looks disabled** and is never the only feedback: say *why* the
      button is off.
- [ ] **Empty states say what goes here and how to fill it.** This is where a
      site feels most unfinished.

---

## 4. Balance and weight

**Contrast is a budget, not a free resource.** Every bold, every accent fill,
every full-bleed image spends from it. A page with one bold headline reads as
confident; a page with six reads as noise.

- **Size before weight before colour.** Make something important by making it
  BIGGER first. Reach for bold second, colour last. Three at once is shouting.
- **Two competing focal points is a tie, and a tie is confusion.** A hero image
  and a hero headline must not be the same visual weight — pick which leads.
- **Accent is ~10% of a screen.** A second accent fill halves the meaning of the
  first, exactly like a second primary button.
- **Symmetry reads as static.** Mirrored elements close into shapes you didn't
  intend — two mirrored cables become a headphone band. Break symmetry when you
  want something to feel alive.

## 4b. Full-bleed media layouts

When a photograph or video is the background and the words sit on top, the rules
change. This is the layout the landing page uses, and it fails in specific ways.

### The dead-stack trap

The wrong instinct is to STACK: eyebrow, then headline, then the image, then more
text, then the buttons — each in its own band, each with a gap. That layout is
mostly empty space with content floating in the middle of it, and on a wide
screen the gaps grow faster than the content does.

**A full-bleed layout has one media layer and one content layer, and they
occupy the same box.** The media fills the section edge to edge (`object-fit:
cover`, `position: absolute; inset: 0`). The content sits on top of it in a
grid. Nothing is above or below the image, so there are no bands and no gaps to
grow.

### Text on an image is unreadable without a scrim

Never put type straight onto a photograph. A photo's brightness varies across
it, so text that clears contrast on the dark half fails on the light half, and
a video changes underneath the text frame by frame.

A **scrim** is a gradient between the media and the content — opaque where the
text is, clear where the image should show. It is not decoration; it is the only
thing making the words legible:

```css
/* Dark at the bottom where the headline sits, clear at the top. */
background: linear-gradient(to top, rgb(0 0 0 / 0.75) 0%, transparent 60%);
```

Rules for it:
- Anchor it to **where the text is**, not uniformly over everything — a flat
  50% wash just makes the photo look muddy and still doesn't guarantee contrast.
- Measure contrast against the **lightest pixel the text can cross**, not the
  average.
- On video, the scrim has to be heavier than a still needs: you cannot see every
  frame, so assume the brightest one.

### Use the corners

A full-bleed section has four corners and a centre. Spreading content into them
is what makes it feel composed rather than centred-by-default:

- top-left: eyebrow / label
- centre or lower-left: the headline and its one action
- bottom-right: the slide counter and arrows
- bottom-left: secondary meta

This is the layout every editorial hero converges on, and the reason is that a
single centred column leaves all four corners empty.

### Keep text out of the subject

If the image has a face or a focal object, the type goes in the negative space
beside it — not across it. When the media is swappable, that means choosing one
safe band (usually the lower third) and keeping every headline inside it.

### The fold

`100svh`, not `100vh`. On mobile `vh` is measured with the browser chrome
retracted, so a `100vh` hero is taller than the visible area and its bottom row —
usually the call to action — sits under the address bar until you scroll.

## 5. Space is structure

Whitespace is not wasted; it is what tells the eye which things belong together.

- **Proximity beats borders.** Related items 8–12px apart, unrelated groups 32px+.
  Most "I'll add a divider" moments are really "I'll add space".
- **Dull screens are usually CRAMPED, not empty.** Before adding another element,
  try more room around the ones already there.
- **Align to one grid.** Ragged left edges read as broken even when nothing is.
- **Cap the measure at ~62ch.** A longer line loses the reader on the return.
- **Columns align by purpose.** In a list, put every price at the same
  x-position — that is what makes a catalogue comparable instead of just long.

## 6. Consistency

- The same action looks the same everywhere. One button style per role, defined
  once in `globals.css`, never re-invented inline.
- The same information lives in the same place on every row and card.
- One entrance animation, reused. See `.claude/skills/motion/SKILL.md`.

## 7. Honest interfaces

- **Show the number that will actually be charged, biggest.** A large figure in a
  currency nobody is billed reads as a bait-and-switch even when it's accurate.
- **Never present a choice that can fail** — don't offer a payment method that
  can't settle, or a licence with no file behind it.
- **Errors say what happened and what to do**, in the user's words. "Invalid
  input" is not a message.
- **Never fake progress.** A spinner that isn't tied to real work is a lie.

---

## Debugging something invisible

When an element does not appear, the instinct is to reach for colour, opacity
and z-index. That instinct cost hours on this repo's hero: the video was
loaded, decoded, playing, correctly graded — and **1521 x 0 pixels**, because a
`height: 100%` child sat inside an anonymous wrapper with `height: auto`. Every
symptom pointed at the colour treatment, so the colour treatment kept getting
"fixed".

**Measure the box first. Always. Before touching a single style.**

```js
const b = el.getBoundingClientRect();
console.log(b.width, b.height, getComputedStyle(el).display, getComputedStyle(el).visibility);
```

Work down this list in order, and stop at the first thing that is wrong:

1. **Does it have a size?** `getBoundingClientRect()` — a zero in either
   dimension ends the investigation.
2. **Is it in the viewport?** A large negative `top` means the page is scrolled
   or the element is positioned off-screen, not that it is hidden.
3. **Is the CSS even matching?** `getComputedStyle(el).filter` returning `none`
   when a filter is expected means the SELECTOR is wrong. A `>` that should be a
   descendant combinator fails silently and matches nothing.
4. **Only then**: opacity, colour, blend mode, z-index.

Two specific traps behind step 1:

- **`height: 100%` needs a parent with a definite height.** Any anonymous
  wrapper in the chain — from an animation library, a provider, a fragment
  boundary — that is `height: auto` collapses it to zero. When a library nests
  wrappers you do not control, size *every* descendant
  (`.parent div { position: absolute; inset: 0 }`), not just the first.
- **A number tuned to fix a symptom hides the cause.** `brightness(3.1)` was
  chosen to rescue "dark" footage that was actually zero pixels tall. When the
  real bug was fixed, that value blew the highlights out. If a value has to be
  extreme to look right, the thing it is compensating for is probably the
  actual bug.

## Review checklist

Run this on any screen before shipping:

1. Squint — is there exactly one loudest thing?
2. Every text/background pair ≥4.5:1 (≥3:1 for large text and controls)?
3. Any hardcoded colour sitting on a token background? (the invisible-badge bug)
4. Tab through — is focus visible the whole way?
5. At 360px wide — is the primary action reachable without scrolling past it?
6. Count the primary buttons. More than one? Demote.
7. Count the accent fills. More than ~10% of the screen? Cut.
8. Is any control hover-only?
9. Do the empty and error states exist, and do they say what to do next?
10. Anything invisible? Measure the box before changing any style.
