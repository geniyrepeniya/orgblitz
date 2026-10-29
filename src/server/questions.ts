import { readFileSync } from 'node:fs'
import type { OptionIndex } from '../shared/messages.ts'

export type Question = {
  text: string
  options: [string, string, string, string]
  correct: OptionIndex
  seconds: number
}

function fail(detail: string): never {
  throw new Error(`questions.json: ${detail}`)
}

function text(value: unknown, detail: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(detail)
  return value.trim()
}

function readQuestion(value: unknown, index: number): Question {
  const label = `questions[${index}]`
  if (typeof value !== 'object' || value === null) fail(label)
  if (!('text' in value) || !('options' in value) || !('correct' in value) || !('seconds' in value)) {
    fail(label)
  }
  if (!Array.isArray(value.options) || value.options.length !== 4) fail(`${label}.options`)
  const first = text(value.options[0], `${label}.options[0]`)
  const second = text(value.options[1], `${label}.options[1]`)
  const third = text(value.options[2], `${label}.options[2]`)
  const fourth = text(value.options[3], `${label}.options[3]`)
  if (value.correct !== 0 && value.correct !== 1 && value.correct !== 2 && value.correct !== 3) {
    fail(`${label}.correct`)
  }
  if (typeof value.seconds !== 'number' || !Number.isInteger(value.seconds) || value.seconds < 1) {
    fail(`${label}.seconds`)
  }
  return {
    text: text(value.text, `${label}.text`),
    options: [first, second, third, fourth],
    correct: value.correct,
    seconds: value.seconds,
  }
}

export function loadQuestions(file: string): Question[] {
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (typeof raw !== 'object' || raw === null || !('questions' in raw) || !Array.isArray(raw.questions)) {
    fail('questions')
  }
  if (raw.questions.length === 0) fail('questions')
  return raw.questions.map((item, index) => readQuestion(item, index))
}
