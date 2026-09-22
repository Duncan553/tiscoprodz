/**
 * ONE PLAYER FOR THE WHOLE SITE.
 *
 * Every play button anywhere writes here, and a single <audio> element in
 * components/AudioPlayer.tsx reads it. The alternative — an <audio> per card —
 * lets two beats play over each other and kills playback the moment you
 * navigate. One element, one source of truth.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PlayerState {
  beatId: string | null;
  title: string;
  coverUrl: string;
  previewUrl: string | null;
  isPlaying: boolean;

  volume: number; // 0–1
  muted: boolean;

  play: (beatId: string, previewUrl: string, title: string, coverUrl: string) => void;
  pause: () => void;
  resume: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      beatId: null,
      title: "",
      coverUrl: "",
      previewUrl: null,
      isPlaying: false,
      volume: 1,
      muted: false,

      play: (beatId, previewUrl, title, coverUrl) =>
        set({ beatId, previewUrl, title, coverUrl, isPlaying: true }),

      pause: () => set({ isPlaying: false }),
      resume: () => { if (get().previewUrl) set({ isPlaying: true }); },

      // Clamped: a range input is not the only caller, and HTMLMediaElement
      // throws on a volume outside 0–1.
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: v === 0 }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: "tiscoprodz-player",
      // ONLY volume survives a reload. Persisting the track would make a fresh
      // visit try to autoplay — browsers block it, and nobody asked for it.
      partialize: (s) => ({ volume: s.volume, muted: s.muted }),
    }
  )
);
