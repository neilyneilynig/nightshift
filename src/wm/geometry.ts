import type { Rect } from '../kernel/types'

export type SnapDir = 'left' | 'right' | 'up' | 'down'
export const MIN_W = 320
export const MIN_H = 200

export function snapRect(dir: SnapDir, a: Rect): Rect {
  const hw = Math.floor(a.w / 2)
  switch (dir) {
    case 'left': return { x: a.x, y: a.y, w: hw, h: a.h }
    case 'right': return { x: a.x + hw, y: a.y, w: a.w - hw, h: a.h }
    case 'up': return { ...a }
    case 'down': {
      const w = Math.round(a.w * 0.6), h = Math.round(a.h * 0.6)
      return { x: a.x + Math.round((a.w - w) / 2), y: a.y + Math.round((a.h - h) / 2), w, h }
    }
  }
}

export function tileRects(n: number, a: Rect, gap = 6): Rect[] {
  if (n <= 0) return []
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols)
  const cw = (a.w - gap * (cols + 1)) / cols
  const ch = (a.h - gap * (rows + 1)) / rows
  return Array.from({ length: n }, (_, i) => {
    const c = i % cols, r = Math.floor(i / cols)
    return { x: Math.round(a.x + gap + c * (cw + gap)), y: Math.round(a.y + gap + r * (ch + gap)), w: Math.round(cw), h: Math.round(ch) }
  })
}

/** Keep a window fully inside the area, within min size. */
export function clampRect(r: Rect, a: Rect): Rect {
  const w = Math.min(Math.max(r.w, MIN_W), a.w)
  const h = Math.min(Math.max(r.h, MIN_H), a.h)
  const x = Math.min(Math.max(r.x, a.x), a.x + a.w - w)
  const y = Math.min(Math.max(r.y, a.y), a.y + a.h - h)
  return { x, y, w, h }
}
