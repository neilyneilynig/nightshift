import type { Registry } from '../kernel/registry'
import type { Category } from '../kernel/types'

const ORDER: Array<[Category, string]> = [['core', 'CORE'], ['netrun', 'NETRUN'], ['tools', 'TOOLS'], ['system', 'SYSTEM'], ['street', 'STREET'], ['doors', 'DOORS']]
let menu: HTMLElement | null = null

function closeMenu() { menu?.remove(); menu = null }

export function toggleJack(anchor: HTMLElement, registry: Registry, extras: Array<{ label: string; run: () => void }>) {
  if (menu) { closeMenu(); return }
  menu = document.createElement('div')
  menu.className = 'jack-menu'
  const head = document.createElement('div'); head.className = 'jack-head'; head.textContent = 'NIGHTSHIFT//OS ─ SELECT PROGRAM'
  menu.append(head)
  const item = (glyph: string, label: string, hint: string, run: () => void) => {
    const b = document.createElement('button'); b.className = 'jack-item'
    const g = document.createElement('span'); g.className = 'jack-glyph'; g.textContent = glyph
    const l = document.createElement('span'); l.textContent = label
    const h = document.createElement('span'); h.className = 'jack-hint'; h.textContent = hint
    b.append(g, l, h)
    b.onclick = () => { closeMenu(); run() }
    return b
  }
  for (const [cat, label] of ORDER) {
    const apps = registry.list().filter(a => a.category === cat)
    if (!apps.length) continue
    const sec = document.createElement('div'); sec.className = 'jack-sec'; sec.textContent = `── ${label} ──`
    menu.append(sec, ...apps.map(a => item(a.glyph, a.name, a.hotkey ?? '', () => registry.launch(a.id))))
  }
  const sec = document.createElement('div'); sec.className = 'jack-sec'; sec.textContent = '── SYS ──'
  menu.append(sec, ...extras.map(x => item('::', x.label, '', x.run)))
  document.body.append(menu)
  const r = anchor.getBoundingClientRect()
  menu.style.left = `${r.left}px`
  menu.style.bottom = `${window.innerHeight - r.top + 4}px`
  const away = (e: Event) => {
    if (menu && !menu.contains(e.target as Node) && e.target !== anchor) { closeMenu(); off() }
  }
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { closeMenu(); off() } }
  const off = () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc, true) }
  document.addEventListener('pointerdown', away, true)
  document.addEventListener('keydown', esc, true)
}
