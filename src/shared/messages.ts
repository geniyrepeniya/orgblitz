export type OptionIndex = 0 | 1 | 2 | 3

export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'podium'

export type RejectReason = 'name' | 'duplicate' | 'code' | 'closed'

export type PlayerSnapshot = {
  id: string
  name: string
  score: number
}

export type QuestionSnapshot = {
  text: string
  options: [string, string, string, string]
}

export type YouSnapshot = {
  id: string
  answered: boolean
  gain: number | null
  rank: number
}

export type Snapshot = {
  phase: Phase
  code: string
  players: PlayerSnapshot[]
  questionIndex: number
  questionCount: number
  question: QuestionSnapshot | null
  endsAt: number | null
  serverNow: number
  correct: OptionIndex | null
  correctCount: number | null
  answeredCount: number
  you: YouSnapshot | null
  qr: string | null
}

export type ClientMessage =
  | { type: 'join'; name: string; code: string }
  | { type: 'resume'; id: string }
  | { type: 'answer'; index: OptionIndex }
  | { type: 'next' }

export type ServerMessage =
  | { type: 'snapshot'; state: Snapshot }
  | { type: 'rejected'; reason: RejectReason }

export const letters = ['А', 'Б', 'В', 'Г'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function asOptionIndex(value: unknown): OptionIndex | null {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : null
}

function isPhase(value: unknown): value is Phase {
  return (
    value === 'lobby' ||
    value === 'question' ||
    value === 'reveal' ||
    value === 'leaderboard' ||
    value === 'podium'
  )
}

function isReject(value: unknown): value is RejectReason {
  return value === 'name' || value === 'duplicate' || value === 'code' || value === 'closed'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function isPlayer(value: unknown): value is PlayerSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.score === 'number'
  )
}

function isQuestion(value: unknown): value is QuestionSnapshot | null {
  if (value === null) return true
  if (!isRecord(value) || typeof value.text !== 'string' || !Array.isArray(value.options)) return false
  if (value.options.length !== 4) return false
  return value.options.every((option) => typeof option === 'string')
}

function isYou(value: unknown): value is YouSnapshot | null {
  if (value === null) return true
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.answered === 'boolean' &&
    isNullableNumber(value.gain) &&
    typeof value.rank === 'number'
  )
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value) || !isPhase(value.phase) || typeof value.code !== 'string') return false
  if (!Array.isArray(value.players) || !value.players.every(isPlayer)) return false
  if (typeof value.questionIndex !== 'number' || typeof value.questionCount !== 'number') return false
  if (typeof value.serverNow !== 'number' || typeof value.answeredCount !== 'number') return false
  if (!isNullableNumber(value.endsAt) || !isNullableNumber(value.correctCount)) return false
  if (!(value.correct === null || asOptionIndex(value.correct) !== null)) return false
  if (!(value.qr === null || typeof value.qr === 'string')) return false
  const question = value.question
  if (!isQuestion(question)) return false
  if (question !== null && !isOptions(question.options)) return false
  return isYou(value.you)
}

function isOptions(value: string[]): value is [string, string, string, string] {
  return value.length === 4
}

export function readClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value)) return null
  if (value.type === 'join' && typeof value.name === 'string' && typeof value.code === 'string') {
    return { type: 'join', name: value.name, code: value.code }
  }
  if (value.type === 'resume' && typeof value.id === 'string') return { type: 'resume', id: value.id }
  if (value.type === 'answer') {
    const index = asOptionIndex(value.index)
    return index === null ? null : { type: 'answer', index }
  }
  if (value.type === 'next') return { type: 'next' }
  return null
}

export function readServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value)) return null
  if (value.type === 'rejected' && isReject(value.reason)) {
    return { type: 'rejected', reason: value.reason }
  }
  if (value.type === 'snapshot' && isSnapshot(value.state)) {
    return { type: 'snapshot', state: value.state }
  }
  return null
}
