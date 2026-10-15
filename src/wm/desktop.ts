import type { Registry } from '../kernel/registry'

export function mountIcons(el: HTMLElement, registry: Registry) {
  el.replaceChildren(...registry.list().filter(a => a.category === 'core' || a.category === 'system').map(a => {
    const b = document.createElement('button')
    b.className = 'icon'
    const g = document.createElement('span'); g.className = 'icon-glyph'; g.textContent = a.glyph
    const n = document.createElement('span'); n.className = 'icon-name'; n.textContent = a.name
    b.append(g, n)
    b.title = a.hotkey ? `${a.name} (${a.hotkey})` : a.name
    b.ondblclick = () => registry.launch(a.id)
    b.onkeydown = e => { if (e.key === 'Enter') registry.launch(a.id) }
    return b
  }))
}
