/**
 * Local audio selection. Prefers the File System Access API and falls back to
 * a plain <input type=file>.
 * Files are never uploaded; object URLs are created on demand and revoked.
 */

export interface LocalTrack {
  id: string
  name: string
  /** created lazily; revoke when done */
  getUrl: () => Promise<string>
  revoke: () => void
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
function trackFromFile(file: File): LocalTrack {
  let url: string | null = null
  return {
    id: `local-${counter++}-${file.name}`,
    name: file.name.replace(/\.[^.]+$/, ''),
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

/** Open the file picker (FS Access API when available). Returns chosen tracks. */
export async function pickLocalAudio(): Promise<LocalTrack[]> {
  if (window.desktopApp) {
    const folder = await window.desktopApp.selectLocalAudioFolder()
    return folder ? folder.tracks.map(trackFromDesktopReference) : []
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
        if (isAudioName(file.name)) tracks.push(trackFromFile(file))
      }
      return tracks
    } catch (err) {
      // AbortError = user cancelled; anything else falls back
      if ((err as DOMException)?.name === 'AbortError') return []
    }
  }
  return pickViaInput()
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
    let settled = false
    let focusTimer: number | null = null
    const finish = (tracks: LocalTrack[]) => {
      if (settled) return
      settled = true
      if (focusTimer !== null) window.clearTimeout(focusTimer)
      window.removeEventListener('focus', onFocus)
      input.remove()
      resolve(tracks)
    }
    const onChange = () => {
      const files = Array.from(input.files ?? []).filter((f) => isAudioName(f.name))
      finish(files.map((f) => trackFromFile(f)))
    }
    // if the dialog is dismissed we can't reliably detect it; resolve on window focus
    const onFocus = () => {
      focusTimer = window.setTimeout(() => {
        if (!input.files || input.files.length === 0) finish([])
      }, 400)
    }
    input.addEventListener('change', onChange, { once: true })
    window.addEventListener('focus', onFocus)
    document.body.appendChild(input)
    input.click()
  })
}
