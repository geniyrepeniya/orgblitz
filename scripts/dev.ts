import { spawn } from 'node:child_process'

const env: NodeJS.ProcessEnv = { ...process.env, PORT: '3000', PUBLIC_URL: 'http://localhost:5173' }
delete env.SERVE_STATIC

const server = spawn(process.execPath, ['--watch', 'src/server/index.ts'], { env, stdio: 'inherit' })
const client = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' })

let stopping = false

function stop(code: number) {
  if (stopping) return
  stopping = true
  server.kill()
  client.kill()
  process.exit(code)
}

server.on('exit', (code) => stop(code ?? 1))
client.on('exit', (code) => stop(code ?? 1))
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
