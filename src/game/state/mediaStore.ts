import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from '../core/save/storage'
import { SAVE_KEYS } from '../config/constants'

export interface RecentVideo {
  id: string
  title: string
  addedAt: number
}

export interface RadioStation {
  name: string
  url: string
}

export interface JournalEntry {
  id: number
  at: number
  text: string
}

interface MediaState {
  recentVideos: RecentVideo[]
  stations: RadioStation[]
  journal: JournalEntry[]
  addVideo: (id: string, title: string) => void
  clearVideos: () => void
  addStation: (s: RadioStation) => void
  removeStation: (url: string) => void
  addJournal: (text: string) => void
  removeJournal: (id: number) => void
  clearJournal: () => void
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
          journal: [{ id: Date.now(), at: Date.now(), text }, ...s.journal].slice(0, 100),
        })),
      removeJournal: (id) => set((s) => ({ journal: s.journal.filter((e) => e.id !== id) })),
      clearJournal: () => set({ journal: [] }),
    }),
    {
      name: SAVE_KEYS.media,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
)
