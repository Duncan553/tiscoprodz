"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { PlateGraphic } from "@/components/hero/Plate";
import { DuotoneFilter } from "@/components/hero/Duotone";
import { Drift } from "@/components/hero/Drift";
import { DUR, EASE_OUT } from "@/lib/motion";

/**
 * THE HERO — full-bleed media with the words ON TOP of it.
 *
 * WHAT THIS REPLACED, because the mistake is worth naming: the previous version
 * STACKED — eyebrow, then a word, then a plate, then another word, then a line,
 * then a button, each in its own band. That layout is mostly gaps, and on a wide
 * screen the gaps grow faster than the content. Half the page was empty red.
 *
 * Now there is ONE media layer and ONE content layer occupying the same box.
 * Nothing sits above or below the image, so there are no bands to grow.
 *
 * The content spreads into the CORNERS rather than sitting in a centred column:
 * eyebrow top-left, headline lower-left, counter and arrows bottom-right. A
 * single centred stack leaves all four corners empty, which is what "not using
 * the space" actually looks like.
 *
 * Legibility comes from the scrim (.hero-scrim), not from luck — see the
 * full-bleed section of .claude/skills/ui-ux/SKILL.md.
 *
 * Three kinds of motion, and they are separate on purpose:
 *   1. AMBIENT  — every layer drifts on its own cycle, forever, no input (Drift)
 *   2. TRANSITION — on a slide change the layers travel DIFFERENT distances
 *   3. SWIPE    — drag to change slides, committed on velocity as well as
 *                 distance, because real gestures are flicks
 */

interface Slide {
  /**
   * A file in `public/hero/`. Dropped in by hand — there is no admin screen for
   * this, because the landing art is part of the SITE, not content someone
   * edits. A missing file falls back to the built-in graphic, so the page is
   * never broken while art is being gathered.
   *
   * An `.mp4`/`.webm`/`.mov` renders as muted looping video; see SlideArt.
   */
  media: string;
  /** A stable key for the slide, used by the dot controls. Not rendered. */
  label: string;
  eyebrow: string;
  title: string;
  line: string;
  cta: { label: string; href: string };
}

const SLIDES: Slide[] = [
  {
    media: "/hero/1.mp4",
    label: "Tisco Prodz",
    eyebrow: "Beats · licensed instantly",
    title: "Tisco\nProdz",
    line: "Beats built for artists who already know what they sound like.",
    cta: { label: "Browse the catalogue", href: "/beats" },
  },
  {
    media: "/hero/2.mp4",
    label: "Untagged",
    eyebrow: "Every beat · untagged",
    title: "Own the\nmaster",
    line: "Pay once and the clean files are yours on the next screen — MP3, WAV, or the full stems.",
    cta: { label: "See what's for sale", href: "/beats" },
  },
  {
    media: "/hero/3.mp4",
    label: "Instant",
    eyebrow: "Card · instant delivery",
    title: "Paid.\nSent.",
    line: "Checkout takes a minute and the download is waiting when it clears.",
    cta: { label: "Read the licences", href: "/licenses" },
  },
];

const AUTOPLAY_MS = 6500;
/** Commit thresholds. See the swipe section of the motion skill. */
const SWIPE_DISTANCE = 120;
const SWIPE_POWER = 8000;

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reduced = useReducedMotion() ?? false;

  const go = useCallback((next: number, dir: number) => {
    setDirection(dir);
    // Wraps both ways: (-1 + 3) % 3 === 2, where a bare % would give -1.
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  /** Taking control ends autoplay — they've told us what they want. */
  const stop = useCallback(() => setStopped(true), []);

  useEffect(() => {
    if (stopped || paused) return;
    const t = setTimeout(() => go(index + 1, 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [stopped, paused, index, go]);

  // Arrow keys. A carousel that can only be swiped is unusable without a
  // touchscreen, and one that can only be clicked is unusable with one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { stop(); go(index - 1, -1); }
      if (e.key === "ArrowRight") { stop(); go(index + 1, 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, stop]);

  /**
   * COMMIT ON VELOCITY OR DISTANCE, not distance alone.
   *
   * A fast flick that barely travels is a deliberate change; a slow drag most of
   * the way across is usually someone who changed their mind. Weighting velocity
   * into the decision is the whole difference between a swipe that feels right
   * and one that feels stuck.
   */
  const onDragEnd = (_: unknown, info: PanInfo) => {
    stop();
    const power = info.offset.x + info.velocity.x * 0.35;
    if (power < -SWIPE_POWER || info.offset.x < -SWIPE_DISTANCE) go(index + 1, 1);
    else if (power > SWIPE_POWER || info.offset.x > SWIPE_DISTANCE) go(index - 1, -1);
    // Neither threshold met: Motion snaps back to the constraints on its own.
  };

  const slide = SLIDES[index];
  const dur = reduced ? DUR.slide * 0.7 : DUR.slide;
  const travel = reduced ? 0.4 : 1;

  /** Layers travel DIFFERENT distances — that difference is the depth. */
  const enter = (shift: number, delay = 0) => ({
    initial: { opacity: 0, x: direction * shift * travel },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction * -shift * travel },
    transition: { duration: dur, ease: EASE_OUT, delay },
  });

  return (
    <section
      className="hero-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      {/* The gradient-map filter definition. Rendered once, referenced by every
          slide's media through `filter: url(#tsc-duotone)`. */}
      <DuotoneFilter />
      {/* ---- media layer: fills the section, edge to edge ---- */}
      {/* Default AnimatePresence, not mode="wait": a gap between two
          backgrounds is a flash of empty page. They overlap briefly instead. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="hero-bg duotone"
          initial={{ opacity: 0, scale: reduced ? 1 : 1.06, x: direction * 60 * travel }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 1.02, x: direction * -60 * travel }}
          transition={{ duration: dur, ease: EASE_OUT }}
        >
          {/* The slowest ambient layer, and the only one that breathes on
              scale — a background that drifts as fast as the type reads as the
              whole page sliding. */}
          <Drift spec={{ period: 19, x: 10, scale: 0.03, phase: -6 }} className="hero-bg__inner">
            <SlideArt src={slide.media} />
          </Drift>
        </motion.div>
      </AnimatePresence>

      {/* The scrim. Not decoration — it is the only thing guaranteeing the
          words stay legible over media nobody has seen yet, including the
          brightest frame of a video. */}
      <div className="hero-scrim" aria-hidden="true" />

      {/* ---- content layer: same box, on top, spread into the corners ---- */}
      {/* drag lives here so the whole hero is grabbable. touch-action: pan-y in
          the CSS is what stops it eating vertical page scroll. */}
      <motion.div
        className="hero-content"
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={onDragEnd}
      >
        {/* There is no counter, no arrows and no dots. The hero advances on its
            own, and a control that only says "the thing already happening can
            happen faster" is clutter on a landing page.

            The gestures stay — swipe and the arrow keys still work, they are
            just not advertised. Nothing is lost except the furniture. */}
        <div className="hero-content__grid">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.p key={`e${index}`} {...enter(28)} className="hero-eyebrow hero-slot--top">
              {slide.eyebrow}
            </motion.p>
          </AnimatePresence>

          <div className="hero-slot--main">
            <AnimatePresence mode="wait" custom={direction}>
              {/* mode="wait" here because two of these cross-fading through
                  each other is illegible for the whole transition. */}
              {/* The shimmer rides ON the h1 rather than a wrapper: it is a
                  background clipped to the glyphs, so it has to be on the
                  element that owns the text. */}
              <motion.h1 key={`t${index}`} {...enter(56)} className="hero-title wordmark-shine">
                {slide.title}
              </motion.h1>
            </AnimatePresence>

            <AnimatePresence mode="wait" custom={direction}>
              {/* 60ms behind the headline. That stagger is what turns a
                  transition into a sequence instead of one block moving. */}
              <motion.div key={`b${index}`} {...enter(30, 0.06)}>
                <p className="hero-line">{slide.line}</p>
                <Link href={slide.cta.href} className="btn mt-5" draggable={false}>
                  {slide.cta.label}
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </motion.div>
    </section>
  );
}

/**
 * The media itself: the file in `public/hero/` when it exists, the built-in
 * graphic when it does not.
 *
 * `failed` state rather than a build-time check, because Next cannot know
 * whether something was dropped into /public. Falling back on `onError` means
 * adding art is copying files in and removing it is deleting them, with no code
 * change either way.
 *
 * VIDEO IS ALWAYS MUTED, and that is not a preference — browsers block autoplay
 * unless a video is muted, so an unmuted hero video does not play quietly, it
 * does not play at all. `playsInline` stops iOS hijacking it fullscreen, and
 * there are no controls because this is scenery, not a clip to operate.
 */
/**
 * How long the hero waits for a first video frame before giving up and showing
 * the graphic instead. Long enough that a slow Kenyan mobile connection still
 * gets its video (an 8MB file at 500KB/s is ~16s, but the FIRST FRAME arrives
 * far sooner because the files are faststart), short enough that nobody stares
 * at an empty hero wondering if the site is broken.
 */
const STALL_MS = 4000;

function SlideArt({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = /\.(mp4|webm|mov)$/i.test(src);

  // The `autoPlay` ATTRIBUTE is not enough on its own. Several browsers — and
  // most automated ones — leave a muted video parked at readyState 4 with
  // `paused: true`, having loaded every byte and started nothing. Calling
  // play() explicitly once the element exists is what actually starts it.
  //
  // The catch is required, not defensive padding: play() returns a promise that
  // REJECTS when a policy blocks it, and an unhandled rejection is a console
  // error on every page load. A hero that refuses to start should be a still
  // frame, not a red error.
  useEffect(() => {
    if (!isVideo) return;
    const v = videoRef.current;
    if (!v) return;
    // Belt and braces: some browsers only honour the muted PROPERTY, not the
    // attribute, and an unmuted video is blocked outright.
    v.muted = true;
    v.play().catch(() => { /* autoplay blocked — the graphic stands in */ });

    // THE SILENT STALL, which `onError` does NOT catch — and which is NOT the
    // same as "failed to load".
    //
    // The obvious check is `readyState < 2` (no frame yet). That catches a slow
    // or dead download, but it misses the worse case, measured on the live site:
    //
    //     readyState 4, 1280x720, 20.8s duration, 15s buffered, error null,
    //     play() RESOLVED without rejecting — and paused:true, currentTime
    //     frozen at 0.14 seconds.
    //
    // Fully loaded, first frame decoded and painted, playback accepted, and
    // then nothing moves. A readyState check would score that as healthy. So
    // the real test is not "did it load" but "is the clock advancing" — the
    // only thing that actually distinguishes a video from a still image.
    //
    // Either way the fallback is the same graphic a hard error shows. A frozen
    // frame is not a disaster on its own, but a hero that silently pretends to
    // be a video is worse than one that is honestly a still.
    const startedAt = v.currentTime;
    const deadline = setTimeout(() => {
      const noFrame = v.readyState < 2;
      const notMoving = v.paused || v.currentTime <= startedAt + 0.05;
      if (noFrame || notMoving) setFailed(true);
    }, STALL_MS);

    // Cancel the moment the clock genuinely advances — `timeupdate` fires with
    // real playback progress, unlike `loadeddata`, which only says bytes
    // arrived and would have cancelled the deadline in exactly the broken case
    // above.
    const cancel = () => {
      if (v.currentTime > startedAt + 0.05) {
        clearTimeout(deadline);
        v.removeEventListener("timeupdate", cancel);
      }
    };
    v.addEventListener("timeupdate", cancel);

    return () => {
      clearTimeout(deadline);
      v.removeEventListener("timeupdate", cancel);
    };
  }, [isVideo, src]);

  if (failed) return <PlateGraphic />;

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        src={src}
        autoPlay muted loop playsInline preload="auto"
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <img src={src} alt="" loading="eager" fetchPriority="high" draggable={false} onError={() => setFailed(true)} />
  );
}
