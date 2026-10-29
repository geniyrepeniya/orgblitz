import { useEffect, useState } from 'react'
import { asOptionIndex, letters, type RejectReason } from '../shared/messages.ts'
import { useGame } from './connection.ts'

const reasons: Record<RejectReason, string> = {
  name: 'имя',
  duplicate: 'имя занято',
  code: 'не тот код',
  closed: 'вход закрыт',
}

export function Play() {
  const game = useGame('play', null)
  const preset = new URLSearchParams(location.search).get('code') ?? ''
  const [name, setName] = useState('')
  const [code, setCode] = useState(preset.toUpperCase())
  const [codeOpen, setCodeOpen] = useState(preset === '')

  useEffect(() => {
    if (!game.ready) return
    const id = sessionStorage.getItem('player')
    if (id) game.send({ type: 'resume', id })
  }, [game.ready, game.send])

  useEffect(() => {
    if (game.state?.you) sessionStorage.setItem('player', game.state.you.id)
  }, [game.state])

  useEffect(() => {
    if (game.rejected === 'closed' && !game.state?.you) sessionStorage.removeItem('player')
  }, [game.rejected, game.state])

  useEffect(() => {
    if (game.rejected === 'code') setCodeOpen(true)
  }, [game.rejected])

  const state = game.state
  if (!state) return <main className="stage" />
  if (!state.you) {
    return (
      <main className="stage">
        <form
          className="join"
          onSubmit={(event) => {
            event.preventDefault()
            game.send({ type: 'join', name, code })
          }}
        >
          {game.rejected ? <p className="hint">{reasons[game.rejected]}</p> : null}
          {codeOpen ? (
            <input
              value={code}
              maxLength={4}
              placeholder="код"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          ) : null}
          <input
            value={name}
            maxLength={16}
            placeholder="имя"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" disabled={!game.ready || name.trim() === '' || code.trim() === ''}>
            Войти
          </button>
        </form>
      </main>
    )
  }

  if (state.phase === 'question' && !state.you.answered) {
    return (
      <main className="stage">
        <div className="pad">
          {letters.map((letter, index) => {
            const option = asOptionIndex(index)
            if (option === null) return null
            return (
              <button key={letter} type="button" data-color={option} onClick={() => game.send({ type: 'answer', index: option })}>
                {letter}
              </button>
            )
          })}
        </div>
      </main>
    )
  }

  if (state.phase === 'question') {
    return (
      <main className="stage">
        <p className="wait">принято</p>
      </main>
    )
  }

  if (state.phase === 'podium') {
    const score = state.players.find((player) => player.id === state.you?.id)?.score ?? 0
    return (
      <main className="stage">
        <div className="scoreline">
          <p className="gain">{state.you.rank}</p>
          <p className="place">{score}</p>
        </div>
      </main>
    )
  }

  if (state.you.gain !== null) {
    return (
      <main className="stage">
        <div className="scoreline">
          <p className="gain">{state.you.gain === 0 ? '0' : `+${state.you.gain}`}</p>
          <p className="place">{state.you.rank}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="stage">
      <p className="wait">смотри на проектор</p>
    </main>
  )
}
