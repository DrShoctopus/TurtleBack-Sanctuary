/**
 * Local audio selection. Prefers the File System Access API (with optional
 * IndexedDB handle persistence) and falls back to a plain <input type=file>.
 * Files are never uploaded; object URLs are created on demand and revoked.
 */

export interface LocalTrack {
  id: string
  name: string
  /** created lazily; revoke when done */
  getUrl: () => Promise<string>
  revoke: () => void
  handle?: FileSystemFileHandle
}

interface DesktopTrackReference {
  id: string
  displayName: string
  playbackUrl: string
}

const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac']

function isAudioName(name: string): boolean {
  const lower = name.toLowerCase()
  return AUDIO_EXT.some((e) => lower.endsWith(e))
}

let counter = 0
function trackFromFile(file: File, handle?: FileSystemFileHandle): LocalTrack {
  let url: string | null = null
  return {
    id: `local-${counter++}-${file.name}`,
    name: file.name.replace(/\.[^.]+$/, ''),
    handle,
    getUrl: async () => {
      if (!url) url = URL.createObjectURL(file)
      return url
    },
    revoke: () => {
      if (url) {
        URL.revokeObjectURL(url)
        url = null
      }
    },
  }
}

interface FSWindow {
  showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>
}

export function supportsFsAccess(): boolean {
  return typeof (window as unknown as FSWindow).showOpenFilePicker === 'function'
}

/** Open the file picker (FS Access API when available). Returns chosen tracks. */
export async function pickLocalAudio(): Promise<{
  tracks: LocalTrack[]
  handles: FileSystemFileHandle[]
}> {
  if (window.desktopApp) {
    const folder = await window.desktopApp.selectLocalAudioFolder()
    return {
      tracks: folder ? folder.tracks.map(trackFromDesktopReference) : [],
      handles: [],
    }
  }
  const w = window as unknown as FSWindow
  if (w.showOpenFilePicker) {
    try {
      const handles = await w.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'Audio',
            accept: {
              'audio/*': AUDIO_EXT as `.${string}`[],
            },
          },
        ],
      })
      const tracks: LocalTrack[] = []
      for (const handle of handles) {
        const file = await handle.getFile()
        if (isAudioName(file.name)) tracks.push(trackFromFile(file, handle))
      }
      return { tracks, handles }
    } catch (err) {
      // AbortError = user cancelled; anything else falls back
      if ((err as DOMException)?.name === 'AbortError') return { tracks: [], handles: [] }
    }
  }
  return { tracks: await pickViaInput(), handles: [] }
}

/** Rebuild app-controlled local track references from the desktop folder registry. */
export async function loadDesktopAudioLibrary(): Promise<LocalTrack[]> {
  if (!window.desktopApp) return []
  const folders = await window.desktopApp.listLocalAudioFolders()
  return folders.flatMap((folder) => folder.tracks.map(trackFromDesktopReference))
}

function trackFromDesktopReference(track: DesktopTrackReference): LocalTrack {
  return {
    id: `desktop-${track.id}`,
    name: track.displayName,
    getUrl: async () => track.playbackUrl,
    revoke: () => undefined,
  }
}

/** Fallback: hidden <input type=file multiple>. */
function pickViaInput(): Promise<LocalTrack[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.multiple = true
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []).filter((f) => isAudioName(f.name))
      resolve(files.map((f) => trackFromFile(f)))
      input.remove()
    })
    // if the dialog is dismissed we can't reliably detect it; resolve on window focus
    const onFocus = () => {
      window.setTimeout(() => {
        if (!input.files || input.files.length === 0) resolve([])
        window.removeEventListener('focus', onFocus)
      }, 400)
    }
    window.addEventListener('focus', onFocus)
    document.body.appendChild(input)
    input.click()
  })
}

// --- optional handle persistence (IndexedDB) --------------------------------

const DB_NAME = 'turtleback-media'
const STORE = 'fileHandles'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null)
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

export async function persistHandles(handles: FileSystemFileHandle[]): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.put(handles, 'handles')
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

/** Re-load persisted handles; caller must re-request permission before use. */
export async function loadPersistedHandles(): Promise<FileSystemFileHandle[]> {
  const db = await openDb()
  if (!db) return []
  const handles = await new Promise<FileSystemFileHandle[]>((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get('handles')
    req.onsuccess = () => resolve((req.result as FileSystemFileHandle[]) ?? [])
    req.onerror = () => resolve([])
  })
  db.close()
  return handles
}

/** Ask (or re-ask) for read permission on a persisted handle. */
export async function ensureHandlePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const h = handle as FileSystemFileHandle & {
    queryPermission?: (o: { mode: string }) => Promise<PermissionState>
    requestPermission?: (o: { mode: string }) => Promise<PermissionState>
  }
  try {
    if (h.queryPermission && (await h.queryPermission({ mode: 'read' })) === 'granted') return true
    if (h.requestPermission && (await h.requestPermission({ mode: 'read' })) === 'granted')
      return true
  } catch {
    /* ignore */
  }
  return false
}

export async function trackFromHandle(handle: FileSystemFileHandle): Promise<LocalTrack | null> {
  try {
    const file = await handle.getFile()
    if (!isAudioName(file.name)) return null
    return trackFromFile(file, handle)
  } catch {
    return null
  }
}
