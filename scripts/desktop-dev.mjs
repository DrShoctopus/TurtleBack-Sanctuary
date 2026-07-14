import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import electronPath from 'electron'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')

await run(process.execPath, [resolve(root, 'scripts/build-desktop.mjs'), '--development'])

const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
await server.listen()

const rendererUrl = 'http://127.0.0.1:5173/'
server.printUrls()

const desktop = spawn(
  electronPath,
  ['.', `--dev-server-url=${rendererUrl}`, ...process.argv.slice(2)],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
  },
)

const stop = async (signal) => {
  if (!desktop.killed) desktop.kill(signal)
  await server.close()
}

process.once('SIGINT', () => void stop('SIGINT'))
process.once('SIGTERM', () => void stop('SIGTERM'))

desktop.once('error', async (error) => {
  console.error(error)
  await server.close()
  process.exitCode = 1
})

desktop.once('exit', async (code, signal) => {
  await server.close()
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}`))
    })
  })
}
