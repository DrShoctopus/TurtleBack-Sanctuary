import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from '../core/save/storage'
import { SAVE_KEYS } from '../config/constants'
import {
  createJournalId,
  migrateMedia,
  type JournalEntry,
  type RadioStation,
  type RecentVideo,
} from '../data/media'

export type { JournalEntry, RadioStation, RecentVideo } from '../data/media'

export interface MediaState {
  recentVideos: RecentVideo[]
  stations: RadioStation[]
  journal: JournalEntry[]
  addVideo: (id: string, title: string) => void
  clearVideos: () => void
  addStation: (s: RadioStation) => void
  removeStation: (url: string) => void
  addJournal: (text: string) => void
  removeJournal: (id: string) => void
  clearJournal: () => void
  replaceAll: (media: Pick<MediaState, 'recentVideos' | 'stations' | 'journal'>) => void
}

export const useMedia = create<MediaState>()(
  persist(
    (set) => ({
      recentVideos: [],
      stations: [],
      journal: [],
      addVideo: (id, title) =>
        set((s) => ({
          recentVideos: [
            { id, title, addedAt: Date.now() },
            ...s.recentVideos.filter((v) => v.id !== id),
          ].slice(0, 12),
        })),
      clearVideos: () => set({ recentVideos: [] }),
      addStation: (st) =>
        set((s) => ({
          stations: [...s.stations.filter((x) => x.url !== st.url), st].slice(0, 20),
        })),
      removeStation: (url) => set((s) => ({ stations: s.stations.filter((x) => x.url !== url) })),
      addJournal: (text) =>
        set((s) => ({
          journal: [{ id: createJournalId(), at: Date.now(), text }, ...s.journal].slice(0, 100),
        })),
      removeJournal: (id) => set((s) => ({ journal: s.journal.filter((e) => e.id !== id) })),
      clearJournal: () => set({ journal: [] }),
      replaceAll: (media) =>
        set({
          recentVideos: media.recentVideos,
          stations: media.stations,
          journal: media.journal,
        }),
    }),
    {
      name: SAVE_KEYS.media,
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persisted) => migrateMedia(persisted) as MediaState,
      merge: (persisted, current) => ({ ...current, ...migrateMedia(persisted) }),
      partialize: (state) =>
        ({
          recentVideos: state.recentVideos,
          stations: state.stations,
          journal: state.journal,
        }) as MediaState,
    },
  ),
)
