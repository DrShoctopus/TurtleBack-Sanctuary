import { createHash, randomUUID } from 'node:crypto'
import { readdir, realpath, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, dialog, net, type ProtocolRequest } from 'electron'
import { z } from 'zod'
import {
  folderIdSchema,
  type LocalAudioFolder,
  type PortableAudioTrack,
} from '../../shared/contracts'
import type { AppLogger } from '../logging/logger'
import { readAtomicJson, writeAtomicJson } from './atomicJson'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac'])
const MAX_TRACKS = 5000

const librarySchema = z.object({
  folders: z
    .array(
      z.object({
        id: folderIdSchema,
        path: z.string().min(1).max(4096),
        displayName: z.string().min(1).max(240),
      }),
    )
    .max(24),
})

type LibraryFile = z.infer<typeof librarySchema>

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

function stableTrackId(root: string, file: string): string {
  const hex = createHash('sha256').update(root).update('\0').update(relative(root, file)).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export class LocalAudioLibrary {
  private readonly tracks = new Map<string, string>()

  constructor(
    private readonly file: string,
    private readonly logger: AppLogger,
  ) {}

  private async readLibrary(): Promise<LibraryFile> {
    const loaded = await readAtomicJson(this.file, librarySchema)
    return loaded.data ?? { folders: [] }
  }

  async selectFolder(window: BrowserWindow): Promise<LocalAudioFolder | null> {
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose a local audio folder',
      properties: ['openDirectory'],
      buttonLabel: 'Use this folder',
    })
    if (result.canceled || result.filePaths.length !== 1) return null

    const selectedPath = await realpath(result.filePaths[0])
    const library = await this.readLibrary()
    let folder = library.folders.find((entry) => entry.path === selectedPath)
    if (!folder) {
      folder = { id: randomUUID(), path: selectedPath, displayName: basename(selectedPath) }
      library.folders = [...library.folders, folder].slice(-24)
      await writeAtomicJson(this.file, library, librarySchema)
    }
    const tracks = await this.scan(folder.path)
    this.logger.info('local_audio.folder_selected', {
      folderId: folder.id,
      trackCount: tracks.length,
    })
    return { folderId: folder.id, displayName: folder.displayName, tracks }
  }

  async list(folderId: string): Promise<PortableAudioTrack[]> {
    const safeId = folderIdSchema.parse(folderId)
    const library = await this.readLibrary()
    const folder = library.folders.find((entry) => entry.id === safeId)
    if (!folder) return []
    return this.scan(folder.path)
  }

  private async scan(rootPath: string): Promise<PortableAudioTrack[]> {
    let root: string
    try {
      root = await realpath(rootPath)
      if (!(await stat(root)).isDirectory()) return []
    } catch {
      this.logger.warn('local_audio.folder_missing')
      return []
    }

    const files: string[] = []
    const pending = [root]
    while (pending.length && files.length < MAX_TRACKS) {
      const directory = pending.shift()!
      let entries
      try {
        entries = await readdir(directory, { withFileTypes: true })
      } catch {
        continue
      }
      entries.sort((a, b) => a.name.localeCompare(b.name))
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const candidate = join(directory, entry.name)
        if (entry.isSymbolicLink()) continue
        if (entry.isDirectory()) pending.push(candidate)
        else if (entry.isFile() && AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          try {
            const canonical = await realpath(candidate)
            if (isWithin(root, canonical)) files.push(canonical)
          } catch {
            // Files can disappear while a large library is being scanned.
          }
        }
        if (files.length >= MAX_TRACKS) break
      }
    }

    const seen = new Set<string>()
    const tracks: PortableAudioTrack[] = []
    for (const file of files) {
      if (seen.has(file)) continue
      seen.add(file)
      const id = stableTrackId(root, file)
      this.tracks.set(id, file)
      const extension = extname(file).slice(1).toLowerCase()
      tracks.push({
        id,
        displayName: basename(file, extname(file)),
        format: extension,
        playbackUrl: `turtleback-media://track/${id}`,
      })
    }
    if (files.length >= MAX_TRACKS) this.logger.warn('local_audio.scan_capped', { limit: MAX_TRACKS })
    return tracks
  }

  async handleProtocol(request: ProtocolRequest): Promise<Response> {
    const url = new URL(request.url)
    if (url.hostname !== 'track') return new Response('Not found', { status: 404 })
    const id = url.pathname.slice(1)
    if (!folderIdSchema.safeParse(id).success) return new Response('Not found', { status: 404 })
    const file = this.tracks.get(id)
    if (!file) return new Response('Not found', { status: 404 })
    try {
      return await net.fetch(pathToFileURL(file).toString(), { headers: request.headers })
    } catch {
      return new Response('Unavailable', { status: 410 })
    }
  }
}
