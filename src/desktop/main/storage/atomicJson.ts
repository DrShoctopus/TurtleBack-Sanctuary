import { copyFile, mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ZodType } from 'zod'

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

async function readAndValidate<T>(file: string, schema: ZodType<T>): Promise<T | null> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
    const result = schema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export interface AtomicReadResult<T> {
  data: T | null
  recoveredFromBackup: boolean
  primaryCorrupt: boolean
}

export async function readAtomicJson<T>(
  file: string,
  schema: ZodType<T>,
): Promise<AtomicReadResult<T>> {
  const primaryExists = await exists(file)
  const primary = primaryExists ? await readAndValidate(file, schema) : null
  if (primary) return { data: primary, recoveredFromBackup: false, primaryCorrupt: false }

  const backup = await readAndValidate(`${file}.bak`, schema)
  if (primaryExists) await quarantineInvalidPrimary(file)
  if (backup) {
    // Repair the primary immediately. The invalid bytes remain in .corrupt for
    // diagnostics instead of being silently replaced by defaults on the next write.
    await writeAtomicJson(file, backup, schema).catch(() => undefined)
    return { data: backup, recoveredFromBackup: true, primaryCorrupt: primaryExists }
  }
  return { data: null, recoveredFromBackup: false, primaryCorrupt: primaryExists }
}

async function quarantineInvalidPrimary(file: string): Promise<void> {
  const corruptFile = `${file}.corrupt`
  await unlink(corruptFile).catch(() => undefined)
  await rename(file, corruptFile).catch(() => undefined)
}

/** Write JSON through a synced temporary file and preserve the last valid primary as .bak. */
export async function writeAtomicJson<T>(
  file: string,
  value: T,
  schema: ZodType<T>,
): Promise<void> {
  const validated = schema.parse(value)
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  const json = `${JSON.stringify(validated, null, 2)}\n`
  try {
    const handle = await open(temp, 'wx', 0o600)
    try {
      await handle.writeFile(json, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }

    if ((await readAndValidate(file, schema)) !== null) {
      await copyFile(file, `${file}.bak`)
    }
    await rename(temp, file)

    // Best-effort directory sync makes the rename durable on supported platforms.
    try {
      const directory = await open(dirname(file), 'r')
      try {
        await directory.sync()
      } finally {
        await directory.close()
      }
    } catch {
      // Windows and some filesystems do not allow syncing a directory handle.
    }
  } catch (error) {
    await unlink(temp).catch(() => undefined)
    throw error
  }
}

export async function deleteAtomicJson(file: string): Promise<void> {
  await Promise.all([
    unlink(file).catch(() => undefined),
    unlink(`${file}.bak`).catch(() => undefined),
    unlink(`${file}.corrupt`).catch(() => undefined),
  ])
}
