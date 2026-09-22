"use client";

import { useRef, useEffect, useState } from "react";
import { usePlayerStore } from "@/stores/usePlayerStore";

/**
 * THE ONLY <audio> ELEMENT ON THE SITE.
 *
 * It lives in the root layout, so it survives navigation — a preview keeps
 * playing while you browse. Every play button writes to usePlayerStore and this
 * reads it. One element also means two beats can never play over each other,
 * which is what happens the moment a second <audio> exists anywhere.
 */
export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const lastUrlRef = useRef<string>("");
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const { beatId, title, coverUrl, previewUrl, isPlaying, volume, muted, pause, resume, setVolume, toggleMute } =
    usePlayerStore();

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // iOS ignores programmatic volume writes — Apple reserves volume for the
  // hardware buttons and the assignment silently does nothing. Feature-detect
  // rather than sniff the user agent, and hide a control that cannot work.
  const [canSetVolume, setCanSetVolume] = useState(true);

  // The store is localStorage-backed, so its first client value can differ from
  // what the server rendered. Waiting for mount avoids a hydration mismatch.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const probe = document.createElement("audio");
    probe.volume = 0.5;
    setCanSetVolume(probe.volume === 0.5);
  }, []);

  // Volume gets its OWN effect. Folded into the load effect below, every nudge
  // of the slider would re-run audio.load() and restart the track.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted, previewUrl]);

  // Load / play / pause. `lastUrlRef` is what stops a re-render from reassigning
  // the same src — assigning audio.src always restarts playback, even with an
  // identical string.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!previewUrl) {
      audio.pause();
      audio.removeAttribute("src");
      lastUrlRef.current = "";
      setProgress(0);
      setDuration(0);
      return;
    }

    if (lastUrlRef.current !== previewUrl) {
      audio.src = previewUrl;
      lastUrlRef.current = previewUrl;
      audio.load();
      setError(null);
    }

    if (isPlaying) {
      // Browsers reject play() that wasn't triggered by a real gesture. Catching
      // it and un-setting isPlaying keeps the UI honest instead of showing a
      // pause button over silence.
      audio.play().catch(() => {
        setError("Tap play to start audio.");
        pause();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, previewUrl, pause]);

  // The spinning disc, driven by rAF rather than a CSS animation. A CSS
  // animation restarts from 0deg every time the class toggles; this keeps the
  // accumulated angle in a ref, so pausing and resuming picks up where it left.
  useEffect(() => {
    const disc = discRef.current;
    if (!disc) return;

    if (isPlaying) {
      let last = performance.now();
      const step = (t: number) => {
        rotationRef.current += ((t - last) / 1000) * 144; // 360deg / 2.5s
        last = t;
        disc.style.transform = `rotate(${rotationRef.current}deg)`;
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);

  if (!mounted || !beatId) return null;

  const fmt = (s: number) => {
    if (!s || Number.isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--surface-0) 92%, transparent)", borderColor: "var(--line)" }}
      role="region"
      aria-label="Audio player"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 sm:gap-4">
        {/* The disc. 48px on a phone: 64px left barely 120px for the title and
            scrubber, which are the parts you actually use. */}
        <div ref={discRef} className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0" style={{ willChange: "transform" }}>
          <div
            className="relative w-full h-full rounded-full overflow-hidden border-2 bg-cover bg-center"
            style={{ borderColor: "var(--line-2)", backgroundImage: coverUrl ? `url(${coverUrl})` : undefined }}
          >
            <div className="absolute inset-[38%] rounded-full" style={{ background: "var(--surface-0)" }} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="eyebrow">Now playing</p>
          <p className="text-sm font-bold truncate leading-tight" style={{ color: "var(--text-1)" }}>
            {title}
          </p>
          {error && <p className="text-[11px] mt-0.5" style={{ color: "#f87171" }}>{error}</p>}

          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: "var(--text-3)" }}>{fmt(progress)}</span>
            <div className="flex-1 relative h-1 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${duration ? (progress / duration) * 100 : 0}%`, background: "var(--accent)" }}
              />
              {/* The real input sits invisible on top, so the styled bar below is
                  what you see while the native control is what you drag. */}
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={progress}
                onChange={(e) => {
                  const t = parseFloat(e.target.value);
                  if (audioRef.current) audioRef.current.currentTime = t;
                  setProgress(t);
                }}
                aria-label="Seek"
                className="absolute inset-0 w-full h-full opacity-0"
              />
            </div>
            <span className="text-[10px] tabular-nums w-8" style={{ color: "var(--text-3)" }}>{fmt(duration)}</span>
          </div>
        </div>

        <button
          onClick={toggleMute}
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          aria-pressed={muted}
          className="w-9 h-9 grid place-items-center rounded-full shrink-0 cursor-pointer"
          style={{ color: "var(--text-2)" }}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3z" />
            {muted || volume === 0 ? (
              <path d="M16.5 12l3-3-1.06-1.06L15.44 11 12.5 8.06 11.44 9.12 14.38 12l-2.94 2.88 1.06 1.06 2.94-2.94 2.94 2.94L19.5 15l-3-3z" />
            ) : (
              <path d="M14 8.2a5 5 0 010 7.6v-1.9a3.2 3.2 0 000-3.8V8.2z" />
            )}
          </svg>
        </button>

        {canSetVolume && (
          <input
            type="range" min={0} max={1} step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="hidden sm:block w-20 shrink-0"
          />
        )}

        <button
          onClick={() => (isPlaying ? pause() : resume())}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-12 h-12 grid place-items-center rounded-full shrink-0 cursor-pointer"
          // Same rule as the cart badge: white text on --accent is white on
          // white now that --accent IS white. --on-accent is the pair.
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" /></svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a) return;
          setProgress(a.currentTime);
          setDuration(a.duration || 0);
        }}
        onEnded={pause}
        onError={() => { setError("Could not load that preview."); pause(); }}
        preload="metadata"
      />
    </div>
  );
}
