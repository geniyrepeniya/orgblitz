import { randomBytes, randomInt } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import sirv from 'sirv'
import { renderSVG } from 'uqr'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { readClientMessage } from '../shared/messages.ts'
import { loadQuestions } from './questions.ts'
import { createRoom } from './room.ts'

const publicUrlText = process.env.PUBLIC_URL
if (!publicUrlText) throw new Error('PUBLIC_URL is required')
const publicUrl = new URL(publicUrlText)
if (publicUrl.protocol !== 'http:' && publicUrl.protocol !== 'https:') {
  throw new Error('PUBLIC_URL must be an absolute http(s) URL')
}

const portText = process.env.PORT
const port = portText === undefined ? Number.NaN : Number(portText)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is required')

const questions = loadQuestions('questions.json')
const code = roomCode()
const key = randomBytes(24).toString('base64url')
const playUrl = new URL('/', publicUrl)
playUrl.searchParams.set('code', code)
const hostUrl = new URL('/host', publicUrl)
hostUrl.searchParams.set('key', key)
const room = createRoom(code, questions, renderSVG(playUrl.href, { ecc: 'M', border: 2 }))

const serveStatic = process.env.SERVE_STATIC === '1'
if (serveStatic && !existsSync('dist/index.html')) throw new Error('dist is missing')
const assets = serveStatic ? sirv('dist', { single: true }) : null

const server = createServer((request, response) => {
  if (!assets) {
    response.statusCode = 404
    response.end()
    return
  }
  assets(request, response)
})

const sockets = new WebSocketServer({ server, path: '/ws', perMessageDeflate: false })
const alive = new WeakMap<WebSocket, boolean>()

sockets.on('connection', (socket, request) => {
  alive.set(socket, true)
  socket.on('pong', () => {
    alive.set(socket, true)
  })

  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const role = url.searchParams.get('role')
  if (role === 'host') {
    if (url.searchParams.get('key') !== key) {
      socket.close(4001)
      return
    }
    room.bindHost(socket)
  } else if (role === 'play') {
    room.greet(socket)
  } else {
    socket.close(4000)
    return
  }

  socket.on('message', (data) => {
    const message = parse(data)
    if (!message) {
      socket.close(4000)
      return
    }
    room.handle(socket, message)
  })

  socket.on('close', () => {
    room.unbind(socket)
  })
})

const pulse = setInterval(() => {
  for (const socket of sockets.clients) {
    if (alive.get(socket) === false) {
      socket.terminate()
      continue
    }
    alive.set(socket, false)
    socket.ping()
  }
}, 15000)

server.on('close', () => {
  clearInterval(pulse)
})

server.on('error', (error) => {
  throw error
})

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`${hostUrl.href}\n`)
})

function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value = ''
  for (let index = 0; index < 4; index += 1) {
    const symbol = alphabet[randomInt(alphabet.length)]
    if (symbol === undefined) throw new Error('room code failed')
    value += symbol
  }
  return value
}

function parse(data: RawData) {
  try {
    return readClientMessage(JSON.parse(frameText(data)))
  } catch {
    return null
  }
}

function frameText(data: RawData): string {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
  return Buffer.from(data).toString('utf8')
}
