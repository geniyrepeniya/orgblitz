import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readServerMessage,
  type ClientMessage,
  type RejectReason,
  type Snapshot,
} from '../shared/messages.ts'

export function useGame(role: 'host' | 'play', key: string | null) {
  const [state, setState] = useState<Snapshot | null>(null)
  const [rejected, setRejected] = useState<RejectReason | null>(null)
  const [denied, setDenied] = useState(false)
  const [ready, setReady] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }, [])

  useEffect(() => {
    let socket: WebSocket | null = null
    let timer = 0
    let stopped = false

    const open = () => {
      const next = new WebSocket(gameSocketUrl(role, key))
      socket = next
      socketRef.current = next
      next.addEventListener('open', () => {
        if (socket === next) setReady(true)
      })
      next.addEventListener('message', (event) => {
        if (socket !== next || typeof event.data !== 'string') return
        const message = readMessage(event.data)
        if (!message) return
        if (message.type === 'snapshot') {
          setState(message.state)
          setRejected(null)
          return
        }
        setRejected(message.reason)
      })
      next.addEventListener('close', (event) => {
        if (socket !== next) return
        setReady(false)
        if (stopped || event.code === 4001) {
          if (event.code === 4001) setDenied(true)
          return
        }
        timer = window.setTimeout(open, 1000)
      })
    }

    open()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      socket?.close()
    }
  }, [role, key])

  return { state, rejected, denied, ready, send }
}

function gameSocketUrl(role: 'host' | 'play', key: string | null): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = new URL(`${protocol}//${location.host}/ws`)
  url.searchParams.set('role', role)
  if (key !== null) url.searchParams.set('key', key)
  return url.href
}

function readMessage(data: string) {
  try {
    return readServerMessage(JSON.parse(data))
  } catch {
    return null
  }
}
