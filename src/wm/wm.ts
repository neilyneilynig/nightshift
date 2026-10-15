import type { Bus } from '../kernel/bus'
import type { CreateOpts, Rect, WinHandle, WindowManagerLike } from '../kernel/types'
import { clampRect, snapRect, tileRects, MIN_H, MIN_W, type SnapDir } from './geometry'

export const NODES = 4

export interface WinState { appId: string; rect: Rect; node: number; minimized: boolean; persist: unknown }
export interface WinInfo { id: number; appId: string; title: string; glyph: string; node: number; minimized: boolean; active: boolean }

interface Win {
  id: number; appId: string; title: string; glyph: string
  el: HTMLElement; body: HTMLElement; nameEl: HTMLElement
  rect: Rect; prevRect: Rect | null; node: number; minimized: boolean; z: number
  persist: unknown
  guards: Array<() => Promise<boolean> | boolean>
  closeCbs: Array<() => void>; resizeCbs: Array<() => void>; focusCbs: Array<() => void>
  handle: WinHandle
}

const FRAME = `<div class="win-title"><span class="win-glyph"></span><span class="win-name"></span><span class="win-btns"><button data-act="min" title="Minimize">_</button><button data-act="max" title="Maximize">□</button><button data-act="close" title="Close">×</button></span></div><div class="win-body"></div><div class="win-resize"></div>`

export class WindowManager implements WindowManagerLike {
  node = 1
  private wins = new Map<number, Win>()
  private nextId = 1
  private topZ = 10
  private activeId: number | null = null

  constructor(private layer: HTMLElement, private bus: Bus) {}

  area(): Rect {
    return { x: 0, y: 0, w: this.layer.clientWidth || window.innerWidth, h: this.layer.clientHeight || window.innerHeight }
  }

  create(o: CreateOpts): WinHandle {
    const id = this.nextId++
    const el = document.createElement('div')
    el.className = 'win'
    el.dataset.app = o.appId
    el.dataset.id = String(id)
    el.innerHTML = FRAME
    const nameEl = el.querySelector('.win-name') as HTMLElement
    ;(el.querySelector('.win-glyph') as HTMLElement).textContent = o.glyph
    nameEl.textContent = o.title
    const cascade = (this.wins.size % 8) * 28
    const size = o.size ?? { w: 720, h: 460 }
    const w: Win = {
      id, appId: o.appId, title: o.title, glyph: o.glyph,
      el, body: el.querySelector('.win-body') as HTMLElement, nameEl,
      rect: clampRect(o.rect ?? { x: 60 + cascade, y: 40 + cascade, ...size }, this.area()),
      prevRect: null, node: o.node ?? this.node, minimized: !!o.minimized, z: 0, persist: null,
      guards: [], closeCbs: [], resizeCbs: [], focusCbs: [],
      handle: undefined as unknown as WinHandle,
    }
    w.handle = this.makeHandle(w)
    this.wins.set(id, w)
    this.layer.append(el)
    this.applyRect(w)
    this.wire(w)
    if (!w.minimized && w.node === this.node) this.focus(id)
    else { w.z = ++this.topZ; el.style.zIndex = String(w.z); this.applyVisibility(w); this.changed() }
    return w.handle
  }

  findByApp(appId: string): WinHandle | undefined {
    for (const w of this.wins.values()) if (w.appId === appId) return w.handle
    return undefined
  }

  focused(): WinHandle | undefined {
    return this.activeId === null ? undefined : this.wins.get(this.activeId)?.handle
  }

  focus(id: number) {
    const w = this.wins.get(id)
    if (!w) return
    if (w.node !== this.node) { this.node = w.node; this.wins.forEach(o => this.applyVisibility(o)) }
    w.minimized = false
    w.z = ++this.topZ
    w.el.style.zIndex = String(w.z)
    this.activeId = id
    for (const o of this.wins.values()) o.el.classList.toggle('active', o.id === id)
    this.applyVisibility(w)
    w.focusCbs.forEach(cb => cb())
    this.changed()
  }

  async close(id: number): Promise<boolean> {
    const w = this.wins.get(id)
    if (!w) return false
    for (const g of w.guards) if (!(await g())) return false
    for (const cb of w.closeCbs) { try { cb() } catch (e) { console.error('[wm] onClose', e) } }
    w.el.remove()
    this.wins.delete(id)
    if (this.activeId === id) this.focusTop()
    this.changed()
    return true
  }

  minimize(id: number) {
    const w = this.wins.get(id)
    if (!w) return
    w.minimized = true
    this.applyVisibility(w)
    if (this.activeId === id) this.focusTop()
    this.changed()
  }

  toggleMax(id: number) {
    const w = this.wins.get(id)
    if (!w) return
    if (w.prevRect) { w.rect = w.prevRect; w.prevRect = null }
    else { w.prevRect = w.rect; w.rect = this.area() }
    this.applyRect(w)
    this.changed()
  }

  snap(id: number, dir: SnapDir) {
    const w = this.wins.get(id)
    if (!w) return
    w.prevRect = w.prevRect ?? w.rect
    w.rect = snapRect(dir, this.area())
    this.applyRect(w)
    this.changed()
  }

  tileAll() {
    const vis = [...this.wins.values()].filter(w => w.node === this.node && !w.minimized).sort((a, b) => a.id - b.id)
    tileRects(vis.length, this.area()).forEach((r, i) => { vis[i].rect = r; vis[i].prevRect = null; this.applyRect(vis[i]) })
    this.changed()
  }

  setNode(n: number) {
    this.node = n
    this.wins.forEach(w => this.applyVisibility(w))
    this.focusTop()
    this.changed()
  }

  moveToNode(id: number, n: number) {
    const w = this.wins.get(id)
    if (!w) return
    w.node = n
    this.applyVisibility(w)
    if (this.activeId === id && n !== this.node) this.focusTop()
    this.changed()
  }

  /** re-clamp every window, e.g. after the app window shrinks */
  reflow() {
    const a = this.area()
    this.wins.forEach(w => { w.rect = clampRect(w.rect, a); this.applyRect(w) })
    this.changed()
  }

  list(): WinInfo[] {
    return [...this.wins.values()].sort((a, b) => a.id - b.id).map(w => ({
      id: w.id, appId: w.appId, title: w.title, glyph: w.glyph, node: w.node, minimized: w.minimized, active: w.id === this.activeId,
    }))
  }

  serialize(): WinState[] {
    return [...this.wins.values()].sort((a, b) => a.z - b.z).map(w => ({
      appId: w.appId, rect: { ...w.rect }, node: w.node, minimized: w.minimized, persist: w.persist,
    }))
  }

  private focusTop() {
    const top = [...this.wins.values()].filter(w => w.node === this.node && !w.minimized).sort((a, b) => b.z - a.z)[0]
    if (top) this.focus(top.id)
    else { this.activeId = null; this.wins.forEach(w => w.el.classList.remove('active')) }
  }

  private makeHandle(w: Win): WinHandle {
    return {
      id: w.id, appId: w.appId, body: w.body,
      setTitle: t => { w.title = t; w.nameEl.textContent = t; this.changed() },
      setPersist: a => { w.persist = a; this.bus.emit('persist:changed') },
      focus: () => this.focus(w.id),
      close: () => this.close(w.id),
      onClose: cb => { w.closeCbs.push(cb) },
      onResize: cb => { w.resizeCbs.push(cb) },
      onFocus: cb => { w.focusCbs.push(cb) },
      beforeClose: g => { w.guards.push(g) },
    }
  }

  private wire(w: Win) {
    const title = w.el.querySelector('.win-title') as HTMLElement
    const grip = w.el.querySelector('.win-resize') as HTMLElement
    w.el.addEventListener('pointerdown', () => { if (this.activeId !== w.id) this.focus(w.id) }, true)
    title.addEventListener('dblclick', e => { if (!(e.target as HTMLElement).closest('button')) this.toggleMax(w.id) })
    title.addEventListener('pointerdown', e => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
      this.drag(e, title, w, (dx, dy, s) => { w.prevRect = null; w.rect = { ...s, x: s.x + dx, y: s.y + dy } })
    })
    grip.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      e.stopPropagation()
      this.drag(e, grip, w, (dx, dy, s) => { w.prevRect = null; w.rect = { ...s, w: Math.max(MIN_W, s.w + dx), h: Math.max(MIN_H, s.h + dy) } })
    })
    w.el.querySelector('.win-btns')!.addEventListener('click', e => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act
      if (act === 'min') this.minimize(w.id)
      else if (act === 'max') this.toggleMax(w.id)
      else if (act === 'close') void this.close(w.id)
    })
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => w.resizeCbs.forEach(cb => cb())).observe(w.body)
  }

  private drag(e: PointerEvent, target: HTMLElement, w: Win, move: (dx: number, dy: number, start: Rect) => void) {
    const sx = e.clientX, sy = e.clientY, start = { ...w.rect }
    target.setPointerCapture?.(e.pointerId)
    document.body.classList.add('dragging')
    const onMove = (ev: PointerEvent) => { move(ev.clientX - sx, ev.clientY - sy, start); this.applyRect(w) }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      document.body.classList.remove('dragging')
      w.rect = clampRect(w.rect, this.area())
      this.applyRect(w)
      this.changed()
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }

  private applyRect(w: Win) {
    Object.assign(w.el.style, { left: `${w.rect.x}px`, top: `${w.rect.y}px`, width: `${w.rect.w}px`, height: `${w.rect.h}px` })
  }

  private applyVisibility(w: Win) {
    w.el.style.display = w.node === this.node && !w.minimized ? '' : 'none'
  }

  private changed() { this.bus.emit('wm:changed') }
}
