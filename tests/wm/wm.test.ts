import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBus } from '../../src/kernel/bus'
import { WindowManager } from '../../src/wm/wm'

let layer: HTMLElement
let wm: WindowManager
beforeEach(() => {
  document.body.innerHTML = '<div id="windows"></div>'
  layer = document.querySelector('#windows')!
  wm = new WindowManager(layer, createBus())
})
const mk = (appId = 'term') => wm.create({ appId, title: appId.toUpperCase(), glyph: '>_' })

describe('WindowManager', () => {
  it('focuses the newest window on top', () => {
    const a = mk(), b = mk()
    expect(wm.focused()?.id).toBe(b.id)
    a.focus()
    expect(wm.focused()?.id).toBe(a.id)
    const za = Number((layer.children[0] as HTMLElement).style.zIndex)
    const zb = Number((layer.children[1] as HTMLElement).style.zIndex)
    expect(za).toBeGreaterThan(zb)
  })
  it('close respects guards and fires onClose', async () => {
    const a = mk()
    const closed = vi.fn()
    a.onClose(closed)
    let allow = false
    a.beforeClose(() => allow)
    expect(await a.close()).toBe(false)
    expect(layer.children).toHaveLength(1)
    allow = true
    expect(await a.close()).toBe(true)
    expect(layer.children).toHaveLength(0)
    expect(closed).toHaveBeenCalledOnce()
  })
  it('nodes hide other nodes\' windows; new windows land on the current node', () => {
    const a = mk()
    wm.setNode(2)
    const b = mk()
    const el = (id: number) => [...layer.children].find(e => (e as HTMLElement).dataset.id === String(id)) as HTMLElement
    expect(el(a.id).style.display).toBe('none')
    expect(el(b.id).style.display).toBe('')
    wm.moveToNode(b.id, 1)
    expect(el(b.id).style.display).toBe('none')
    wm.focus(a.id)
    expect(wm.node).toBe(1)
  })
  it('minimize hides; focus restores', () => {
    const a = mk()
    wm.minimize(a.id)
    expect(wm.list()[0].minimized).toBe(true)
    a.focus()
    expect(wm.list()[0].minimized).toBe(false)
  })
  it('serializes persist args, node and rect', () => {
    const a = mk('edit')
    a.setPersist({ files: ['x.ts'] })
    const s = wm.serialize()
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ appId: 'edit', node: 1, minimized: false, persist: { files: ['x.ts'] } })
    expect(s[0].rect.w).toBeGreaterThanOrEqual(320)
  })
})

describe('canCloseAll', () => {
  it('asks every window and refuses if any guard refuses', async () => {
    const a = mk(), b = mk('edit')
    a.beforeClose(() => true)
    expect(await wm.canCloseAll()).toBe(true)
    b.beforeClose(async () => false)
    expect(await wm.canCloseAll()).toBe(false)
  })
})
