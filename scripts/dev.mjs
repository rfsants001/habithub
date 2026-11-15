import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const host = '127.0.0.1'
const windows = process.platform === 'win32'
const services = {
  api: { name: 'API', tool: 'tsx', args: ['watch', '--clear-screen=false', 'src/server.ts'], port: 'PORT', defaultPort: 3000, readyPath: '/health', dependencies: ['fastify', 'better-sqlite3', 'pino-pretty'] },
  web: { name: 'Web', tool: 'vite', args: [], port: 'WEB_PORT', defaultPort: 5173, readyPath: '/', dependencies: ['@vitejs/plugin-react', 'lucide-react', 'react-dom'] },
}
const children = []
const startup = new AbortController()

function prepare(key) {
  const service = services[key]
  const port = Number(process.env[service.port] ?? service.defaultPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${service.port} precisa ser uma porta entre 1 e 65535.`)
  }

  const cwd = fileURLToPath(new URL(`../${key}/`, import.meta.url))
  const require = createRequire(resolve(cwd, 'package.json'))
  let manifestPath
  try {
    for (const dependency of service.dependencies) require.resolve(dependency)
    manifestPath = require.resolve(`${service.tool}/package.json`)
  } catch (error) {
    const missing = error.message.split('\n')[0]
    throw new Error(`${service.name}: ${missing}. Na raiz do HabitHub, rode npm run setup e tente novamente.`)
  }

  const { bin } = require(manifestPath)
  const cli = resolve(dirname(manifestPath), typeof bin === 'string' ? bin : bin[service.tool])
  return { ...service, cwd, cli, address: `http://${host}:${port}`, number: port }
}

async function checkPort(service) {
  const server = createServer()
  try {
    await new Promise((ready, fail) => {
      server.once('error', fail)
      server.listen(service.number, host, () => server.close(ready))
    })
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      throw new Error(`${service.name}: a porta ${service.number} já está em uso. Encerre o processo ou defina ${service.port} com outra porta.`)
    }
    throw error
  }
}

function signalTree(child, signal) {
  if (!child.pid) return
  if (windows) {
    if (child.exitCode !== null || child.signalCode !== null) return
    const taskkill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    taskkill.on('error', () => child.kill())
    return
  }
  try {
    process.kill(-child.pid, signal)
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(`[HabitHub] ${error.message}`)
  }
}

function stop(code, message) {
  if (startup.signal.aborted) return
  startup.abort()
  process.exitCode = code
  if (message) console.error(`[HabitHub] ${message}`)
  for (const child of children) signalTree(child, 'SIGTERM')
  if (!windows && children.length > 0) {
    // A process group can still have a watcher child after its leader exits.
    setTimeout(() => {
      for (const child of children) signalTree(child, 'SIGKILL')
    }, 1500)
  }
}

function launch(service) {
  const child = spawn(process.execPath, [service.cli, ...service.args], {
    cwd: service.cwd,
    detached: !windows,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  })
  children.push(child)
  child.on('error', error => stop(1, `${service.name}: ${error.message}`))
  child.on('exit', (code, signal) => {
    stop(code || 1, `${service.name} encerrou (${signal ?? `código ${code}`}). Confira a saída acima.`)
  })
}

async function waitFor(url, serviceName) {
  const timeout = AbortSignal.timeout(20_000)
  const signal = AbortSignal.any([startup.signal, timeout])
  try {
    while (!signal.aborted) {
      try {
        const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]) })
        await response.body?.cancel()
        if (response.ok) return
      } catch {
        // The watcher may still be starting up.
      }
      await delay(200, undefined, { signal })
    }
  } catch (error) {
    if (!timeout.aborted) throw error
  }
  throw new Error(`${serviceName} não respondeu em ${url}. Confira a saída acima.`)
}

process.on('SIGINT', () => stop(130))
process.on('SIGTERM', () => stop(143))

try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Use Node.js 24 ou superior.')
  const target = process.argv[2]
  if (target && !Object.hasOwn(services, target)) throw new Error('Use npm run dev, npm run dev:api ou npm run dev:web.')
  const selected = (target ? [target] : Object.keys(services)).map(prepare)
  if (selected.length === 2 && selected[0].number === selected[1].number) {
    throw new Error('Use portas diferentes para PORT e WEB_PORT.')
  }
  await Promise.all(selected.map(checkPort))
  for (const service of selected) {
    startup.signal.throwIfAborted()
    launch(service)
    await waitFor(`${service.address}${service.readyPath}`, service.name)
  }
  if (!target) await waitFor(`${selected[1].address}/api/health`, 'Proxy Web → API')
  startup.signal.throwIfAborted()
  const urls = selected.map(service => `${service.name} em ${service.address}`).join(' · ')
  console.log(`[HabitHub] ${urls} · Ctrl+C para encerrar.`)
} catch (error) {
  stop(1, error.message)
}
