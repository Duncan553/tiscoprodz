# Hero media

Three files, one per landing slide. The background of each slide is this file —
full-bleed, edge to edge, behind the words. Swap a file and that slide changes;
there is no admin screen and no code to touch.

    public/hero/1.mp4
    public/hero/2.mp4
    public/hero/3.mp4

Stills work too: rename to `.jpg`, `.png` or `.webp` and change the extension in
`SLIDES` in `src/components/hero/HeroSlider.tsx`. The component reads the
extension and switches element type itself. A missing file falls back to the
built-in lit background, so the page is never broken while media is being
swapped.

## What is in here now

Placeholders from **Mixkit**, chosen to match the references this site was
designed from. All three are Mixkit Free License: free for commercial use, no
attribution required.

| file | Mixkit clip | why |
|---|---|---|
| `1.mp4` | `282` — abstract red fabric flowing | smooth, no loop seam |
| `2.mp4` | `33872` — silhouette of a robed figure | the red hooded-figure poster |
| `3.mp4` | `51757` — dancer silhouette on red | a human subject, high contrast |

### Why clip 1 was changed

The first choice (`35333`, neon tunnel) was only **3.3 seconds long**. A loop
that short restarts constantly, and on a bright graphic subject the restart
reads as a flash — "blipping". Measured against the replacement:

| | duration | mean luma |
|---|---|---|
| neon tunnel | 3.3s | 17/255 |
| flowing fabric | 20.8s | 79/255 |

**Check the duration before anything else when picking hero footage.** Under
~8 seconds and the loop becomes the thing people notice. Longer and darker-to-
mid is safer than short and dramatic.

**Replace them whenever you have your own.** These are stand-ins so the site is
not empty, not a final choice — your own footage will always beat stock.

## What works here

- **Landscape**, 16:9 or wider. It crops to fill, so nothing is letterboxed.
- **Subject centre or right.** The headline sits lower-LEFT and the scrim
  darkens that corner, so anything important on the left gets covered.
- **Don't colour-grade.** Everything is converted to the site's red duotone in
  CSS. Media that arrives already red comes out muddy.
- **Video is muted, looped, no controls.** The muting is not a preference —
  browsers block autoplay unless a video is muted, so an unmuted hero video does
  not play quietly, it does not play at all.
- **Keep each file small.** 720p is plenty behind a wordmark. Slide 1 loads on
  arrival, so that one especially wants to be a couple of MB, not twenty.

## Licensing

Only put files here that are yours or properly licensed. **A Pinterest pin is
not a source** — every pin belongs to whoever made it, and this is a commercial
site selling licences. Using someone's footage without permission on a page that
sells intellectual property is the kind of thing that gets a takedown.

Safe sources: your own footage, a commission, or a free-commercial library —
Mixkit and Coverr (both used here), or Pexels.
