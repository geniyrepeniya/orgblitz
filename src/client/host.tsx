import { useEffect, useRef, useState } from 'react'
import { asOptionIndex, letters, type Snapshot } from '../shared/messages.ts'
import { useGame } from './connection.ts'

export function Host() {
  const key = new URLSearchParams(location.search).get('key')
  const game = useGame('host', key)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'ArrowRight') return
      event.preventDefault()
      game.send({ type: 'next' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game.send])

  if (game.denied) {
    return (
      <main className="stage">
        <p className="wait">нет доступа</p>
      </main>
    )
  }

  const state = game.state
  if (!state) return <main className="stage" />
  if (state.phase === 'lobby') return <Lobby state={state} />
  if (state.phase === 'question' || state.phase === 'reveal') return <Question state={state} />
  return <Ranks players={state.players} limit={state.phase === 'podium' ? 3 : 5} />
}

function Lobby({ state }: { state: Snapshot }) {
  return (
    <main className="stage">
      <section className="lobby">
        {state.qr ? <div className="qr" dangerouslySetInnerHTML={{ __html: state.qr }} /> : null}
        <p className="code">{state.code}</p>
        <div className="names">
          {state.players.map((player) => (
            <span key={player.id}>{player.name}</span>
          ))}
        </div>
      </section>
    </main>
  )
}

function Question({ state }: { state: Snapshot }) {
  const remaining = useRemaining(state.endsAt, state.serverNow)
  const question = state.question
  if (!question) return <main className="stage" />
  return (
    <main className="stage">
      <section className="board">
        <header className="bar">
          <p className="meta">
            {state.questionIndex + 1}/{state.questionCount}
          </p>
          <p className="timer">
            {state.phase === 'question' ? Math.ceil(remaining / 1000) : `${state.correctCount ?? 0}/${state.players.length}`}
          </p>
        </header>
        <h1 className="prompt">{question.text}</h1>
        <div className="options">
          {question.options.map((option, index) => {
            const color = asOptionIndex(index)
            if (color === null) return null
            const dim = state.correct !== null && state.correct !== color
            return (
              <div key={color} className="option" data-color={color} data-dim={dim ? '' : undefined}>
                <span className="letter">{letters[color]}</span>
                <span>{option}</span>
              </div>
            )
          })}
        </div>
        {state.phase === 'question' ? (
          <p className="meta count">
            {state.answeredCount}/{state.players.length}
          </p>
        ) : null}
      </section>
    </main>
  )
}

function Ranks({ players, limit }: { players: Snapshot['players']; limit: number }) {
  return (
    <main className="stage">
      <ol className="ranks" data-final={limit === 3 ? '' : undefined}>
        {players.slice(0, limit).map((player, index) => (
          <li key={player.id}>
            <span>{index + 1}</span>
            <span>{player.name}</span>
            <span>{player.score}</span>
          </li>
        ))}
      </ol>
    </main>
  )
}

function useRemaining(endsAt: number | null, serverNow: number): number {
  const skew = useRef(serverNow - Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    skew.current = serverNow - Date.now()
  }, [serverNow])

  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(id)
  }, [endsAt])

  if (endsAt === null) return 0
  return Math.max(0, endsAt - (now + skew.current))
}
