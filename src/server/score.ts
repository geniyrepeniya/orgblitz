export function points(elapsedMs: number, durationMs: number): number {
  const ratio = Math.min(1, Math.max(0, elapsedMs / durationMs))
  return Math.round((1 - ratio / 2) * 1000)
}
