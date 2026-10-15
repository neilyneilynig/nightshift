import { describe, it, expect, vi } from 'vitest'
import { createBus } from '../../src/kernel/bus'
import { createRegistry } from '../../src/kernel/registry'
import type { AppManifest, CreateOpts, WinHandle } from '../../src/kernel/types'

function fakeWm() {
  const wins: WinHandle[] = []
  return {
    wins,
    create: vi.fn((o: CreateOpts) => {
      const h = { id: wins.length + 1, appId: o.appId, body: document.createElement('div'), setTitle() {}, setPersist: vi.fn(), focus: vi.fn(), close: async () => true, onClose() {}, onResize() {}, onFocus() {}, beforeClose() {} } as unknown as WinHandle
      wins.push(h)
      return h
    }),
    findByApp: (id: string) => wins.find(w => w.appId === id),
  }
}
const app = (o: Partial<AppManifest>): AppManifest => ({ id: 'a', name: 'A', glyph: 'A', category: 'core', multi: false, open: vi.fn(), ...o })

describe('registry', () => {
  it('singleton apps focus the existing window and receive args via bus', () => {
    const wm = fakeWm(), bus = createBus(), reg = createRegistry(wm, bus)
    const m = app({ id: 'edit' })
    reg.register(m)
    const onArgs = vi.fn()
    bus.on('edit:args', onArgs)
    const w1 = reg.launch('edit', { files: ['a'] })
    const w2 = reg.launch('edit', { open: { path: 'b' } })
    expect(w1).toBe(w2)
    expect(wm.create).toHaveBeenCalledOnce()
    expect(m.open).toHaveBeenCalledOnce()
    expect(w1!.focus).toHaveBeenCalled()
    expect(onArgs).toHaveBeenCalledWith({ open: { path: 'b' } })
    expect(w1!.setPersist).toHaveBeenCalledWith({ files: ['a'] })
  })
  it('multi apps open new windows; overlay apps never create windows', () => {
    const wm = fakeWm(), reg = createRegistry(wm, createBus())
    const run = vi.fn()
    reg.register(app({ id: 'term', multi: true }))
    reg.register(app({ id: 'sysop', open: undefined, run }))
    reg.launch('term'); reg.launch('term')
    expect(wm.create).toHaveBeenCalledTimes(2)
    expect(reg.launch('sysop', 1)).toBeNull()
    expect(run).toHaveBeenCalledWith(1)
  })
  it('rejects duplicates and unknown ids', () => {
    const reg = createRegistry(fakeWm(), createBus())
    reg.register(app({ id: 'x' }))
    expect(() => reg.register(app({ id: 'x' }))).toThrow(/duplicate/)
    expect(() => reg.launch('nope')).toThrow(/unknown app/)
  })
})
