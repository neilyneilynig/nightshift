import { describe, it, expect } from 'vitest'
import { snapRect, tileRects, clampRect } from '../../src/wm/geometry'

const A = { x: 0, y: 0, w: 1000, h: 800 }

describe('geometry', () => {
  it('snaps halves, max and centered', () => {
    expect(snapRect('left', A)).toEqual({ x: 0, y: 0, w: 500, h: 800 })
    expect(snapRect('right', A)).toEqual({ x: 500, y: 0, w: 500, h: 800 })
    expect(snapRect('up', A)).toEqual(A)
    expect(snapRect('down', A)).toEqual({ x: 200, y: 160, w: 600, h: 480 })
  })
  it('tiles into a grid inside the area', () => {
    expect(tileRects(0, A)).toEqual([])
    expect(tileRects(1, A)).toEqual([{ x: 6, y: 6, w: 988, h: 788 }])
    const four = tileRects(4, A)
    expect(four).toHaveLength(4)
    expect(four[3].x).toBeGreaterThan(four[2].x)
    expect(four[2].y).toBeGreaterThan(four[0].y)
    for (const r of four) expect(r.x + r.w).toBeLessThanOrEqual(1000)
  })
  it('clamps off-screen and oversized windows into view', () => {
    expect(clampRect({ x: 3000, y: -50, w: 400, h: 300 }, A)).toEqual({ x: 600, y: 0, w: 400, h: 300 })
    expect(clampRect({ x: 10, y: 10, w: 5000, h: 5000 }, A)).toEqual({ x: 0, y: 0, w: 1000, h: 800 })
    expect(clampRect({ x: 10, y: 10, w: 10, h: 10 }, A)).toEqual({ x: 10, y: 10, w: 320, h: 200 })
  })
})
