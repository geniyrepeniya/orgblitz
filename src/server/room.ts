import { randomUUID } from 'node:crypto'
import { WebSocket } from 'ws'
import type { ClientMessage, OptionIndex, Phase, ServerMessage, Snapshot } from '../shared/messages.ts'
import type { Question } from './questions.ts'
import { points } from './score.ts'

const rejoinMs = 4000

type Player = {
  id: string
  name: string
  score: number
  socket: WebSocket | null
  answer: OptionIndex | null
  answeredAt: number | null
  gain: number | null
  leaveTimer: NodeJS.Timeout | null
}

export function createRoom(code: string, questions: Question[], qr: string) {
  let phase: Phase = 'lobby'
  let questionIndex = 0
  let endsAt: number | null = null
  let startedAt: number | null = null
  let durationMs = 0
  let timer: NodeJS.Timeout | null = null
  let host: WebSocket | null = null
  const players = new Map<string, Player>()

  function send(socket: WebSocket | null, message: ServerMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  function ranked(): Player[] {
    return [...players.values()].sort(
      (left, right) => right.score - left.score || left.name.localeCompare(right.name, 'ru'),
    )
  }

  function view(socket: WebSocket): Snapshot {
    const question = questions[questionIndex]
    const visible = phase === 'question' || phase === 'reveal'
    const revealed = phase === 'reveal'
    const player = [...players.values()].find((item) => item.socket === socket) ?? null
    const place = player === null ? 0 : ranked().findIndex((item) => item.id === player.id) + 1
    return {
      phase,
      code,
      players: ranked().map((item) => ({ id: item.id, name: item.name, score: item.score })),
      questionIndex,
      questionCount: questions.length,
      question:
        visible && question
          ? { text: question.text, options: question.options }
          : null,
      endsAt: phase === 'question' ? endsAt : null,
      serverNow: Date.now(),
      correct: revealed && question ? question.correct : null,
      correctCount:
        revealed && question
          ? [...players.values()].filter((item) => item.answer === question.correct).length
          : null,
      answeredCount: [...players.values()].filter((item) => item.answer !== null).length,
      you: player
        ? {
            id: player.id,
            answered: player.answer !== null,
            gain: revealed || phase === 'leaderboard' ? player.gain : null,
            rank: place,
          }
        : null,
      qr: socket === host ? qr : null,
    }
  }

  function broadcast() {
    if (host) send(host, { type: 'snapshot', state: view(host) })
    for (const player of players.values()) {
      if (player.socket) send(player.socket, { type: 'snapshot', state: view(player.socket) })
    }
  }

  function clearTimer() {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function closeQuestion() {
    if (phase !== 'question' || startedAt === null) return
    const question = questions[questionIndex]
    if (!question) return
    clearTimer()
    for (const player of players.values()) {
      const gain =
        player.answer === question.correct && player.answeredAt !== null
          ? points(player.answeredAt - startedAt, durationMs)
          : 0
      player.gain = gain
      player.score += gain
    }
    phase = 'reveal'
    endsAt = null
    broadcast()
  }

  function openQuestion(index: number) {
    const question = questions[index]
    if (!question) return
    questionIndex = index
    phase = 'question'
    startedAt = Date.now()
    durationMs = question.seconds * 1000
    endsAt = startedAt + durationMs
    for (const player of players.values()) {
      player.answer = null
      player.answeredAt = null
      player.gain = null
    }
    clearTimer()
    timer = setTimeout(closeQuestion, durationMs)
    broadcast()
  }

  function dropAbsent() {
    for (const player of players.values()) {
      if (player.socket !== null) continue
      if (player.leaveTimer) clearTimeout(player.leaveTimer)
      players.delete(player.id)
    }
  }

  function advance() {
    if (phase === 'lobby') {
      dropAbsent()
      if (players.size === 0) return
      openQuestion(0)
      return
    }
    if (phase === 'reveal') {
      phase = 'leaderboard'
      broadcast()
      return
    }
    if (phase === 'leaderboard') {
      if (questionIndex + 1 < questions.length) openQuestion(questionIndex + 1)
      else {
        phase = 'podium'
        broadcast()
      }
    }
  }

  function join(socket: WebSocket, name: string, entered: string) {
    if ([...players.values()].some((player) => player.socket === socket)) return
    if (entered.toUpperCase() !== code) {
      send(socket, { type: 'rejected', reason: 'code' })
      return
    }
    if (phase !== 'lobby') {
      send(socket, { type: 'rejected', reason: 'closed' })
      return
    }
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 16 || /[\u0000-\u001F]/.test(trimmed)) {
      send(socket, { type: 'rejected', reason: 'name' })
      return
    }
    const taken = [...players.values()].some(
      (player) => player.name.toLocaleLowerCase('ru') === trimmed.toLocaleLowerCase('ru'),
    )
    if (taken) {
      send(socket, { type: 'rejected', reason: 'duplicate' })
      return
    }
    const id = randomUUID()
    players.set(id, {
      id,
      name: trimmed,
      score: 0,
      socket,
      answer: null,
      answeredAt: null,
      gain: null,
      leaveTimer: null,
    })
    broadcast()
  }

  function resume(socket: WebSocket, id: string) {
    const player = players.get(id)
    if (!player) {
      send(socket, { type: 'rejected', reason: 'closed' })
      return
    }
    if (player.leaveTimer) clearTimeout(player.leaveTimer)
    player.leaveTimer = null
    const previous = player.socket
    player.socket = socket
    if (previous && previous !== socket) previous.close()
    broadcast()
  }

  function answer(socket: WebSocket, index: OptionIndex) {
    if (phase !== 'question') return
    const player = [...players.values()].find((item) => item.socket === socket)
    if (!player || player.answer !== null) return
    player.answer = index
    player.answeredAt = Date.now()
    broadcast()
    const active = [...players.values()].filter((item) => item.socket)
    if (active.length > 0 && active.every((item) => item.answer !== null)) closeQuestion()
  }

  return {
    bindHost(socket: WebSocket) {
      const previous = host
      host = socket
      if (previous && previous !== socket) previous.close()
      broadcast()
    },
    greet(socket: WebSocket) {
      send(socket, { type: 'snapshot', state: view(socket) })
    },
    handle(socket: WebSocket, message: ClientMessage) {
      if (message.type === 'next') {
        if (socket === host) advance()
        return
      }
      if (socket === host) return
      if (message.type === 'join') join(socket, message.name, message.code)
      if (message.type === 'resume') resume(socket, message.id)
      if (message.type === 'answer') answer(socket, message.index)
    },
    unbind(socket: WebSocket) {
      if (host === socket) host = null
      for (const player of players.values()) {
        if (player.socket !== socket) continue
        player.socket = null
        if (phase !== 'lobby') continue
        player.leaveTimer = setTimeout(() => {
          if (player.socket !== null) return
          players.delete(player.id)
          broadcast()
        }, rejoinMs)
      }
      broadcast()
    },
  }
}
