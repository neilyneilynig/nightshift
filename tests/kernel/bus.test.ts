import { describe, it, expect, vi } from 'vitest'
import { createBus } from '../../src/kernel/bus'

describe('bus', () => {
  it('delivers, unsubscribes, and isolates handler errors', () => {
    const bus = createBus()
    const a = vi.fn(), b = vi.fn()
    const offA = bus.on('x', a)
    bus.on('x', () => { throw new Error('boom') })
    bus.on('x', b)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    bus.emit('x', 1)
    expect(a).toHaveBeenCalledWith(1)
    expect(b).toHaveBeenCalledWith(1)
    offA()
    bus.emit('x', 2)
    expect(a).toHaveBeenCalledTimes(1)
  })
})
