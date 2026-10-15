import { describe, it, expect } from 'vitest'
import { createPtyRouter } from '../../src/apps/term/router'

describe('pty router', () => {
  it('buffers data that arrives before attach, then streams', () => {
    const r = createPtyRouter()
    const got: number[][] = []
    r.route(1, new Uint8Array([1]))
    r.route(1, new Uint8Array([2]))
    r.attach(1, d => got.push([...d]))
    r.route(1, new Uint8Array([3]))
    expect(got).toEqual([[1], [2], [3]])
  })
  it('drops data after detach and does not leak buffers', () => {
    const r = createPtyRouter()
    const got: number[] = []
    r.attach(2, d => got.push(...d))
    r.detach(2)
    r.route(2, new Uint8Array([9]))
    expect(got).toEqual([])
    expect(r.pendingCount()).toBe(0)
  })
})
