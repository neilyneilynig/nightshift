import type { Bus } from '../kernel/bus'
import { workspace } from '../workspace'
import { NODES, type WindowManager } from './wm'

export function mountTaskbar(el: HTMLElement, wm: WindowManager, bus: Bus, onJack: (anchor: HTMLElement) => void) {
  el.innerHTML = `<button class="tb-jack">◢ JACK</button><div class="tb-nodes"></div><div class="tb-wins"></div><div class="tb-right"><span class="tb-ws"></span><span class="tb-clock"></span></div>`
  const jack = el.querySelector('.tb-jack') as HTMLElement
  const nodesEl = el.querySelector('.tb-nodes') as HTMLElement
  const winsEl = el.querySelector('.tb-wins') as HTMLElement
  const wsEl = el.querySelector('.tb-ws') as HTMLElement
  const clock = el.querySelector('.tb-clock') as HTMLElement
  jack.onclick = () => onJack(jack)

  const render = () => {
    const all = wm.list()
    nodesEl.replaceChildren(...Array.from({ length: NODES }, (_, i) => {
      const n = i + 1
      const b = document.createElement('button')
      b.className = 'tb-node' + (wm.node === n ? ' active' : '') + (all.some(w => w.node === n) ? ' busy' : '')
      b.textContent = String(n)
      b.title = `Node ${n} (Ctrl+Alt+${n})`
      b.onclick = () => wm.setNode(n)
      return b
    }))
    winsEl.replaceChildren(...all.filter(w => w.node === wm.node).map(w => {
      const b = document.createElement('button')
      b.className = 'tb-win' + (w.active ? ' active' : '') + (w.minimized ? ' min' : '')
      b.textContent = `${w.glyph} ${w.title}`
      b.onclick = () => (w.active ? wm.minimize(w.id) : wm.focus(w.id))
      return b
    }))
  }
  const renderWs = () => { wsEl.textContent = `◈ ${workspace.name()}` }
  const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour12: false }) }
  bus.on('wm:changed', render)
  bus.on('workspace:changed', renderWs)
  render(); renderWs(); tick()
  setInterval(tick, 1000)
}
