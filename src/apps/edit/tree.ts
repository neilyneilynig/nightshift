import { ipc } from '../../ipc'
import { workspace } from '../../workspace'

export function createTree(host: HTMLElement, onOpen: (path: string) => void) {
  const expanded = new Set<string>()

  async function renderDir(container: HTMLElement, rel: string, depth: number) {
    let entries
    try { entries = await ipc.list(rel) } catch (e) { container.textContent = `  ${String(e)}`; return }
    container.replaceChildren()
    for (const e of entries) {
      const row = document.createElement('div')
      row.className = 'tree-row' + (e.is_dir ? ' dir' : '')
      row.style.paddingLeft = `${6 + depth * 12}px`
      row.title = e.path
      const label = () => { row.textContent = (e.is_dir ? (expanded.has(e.path) ? '▾ ' : '▸ ') : '  ') + e.name }
      label()
      container.append(row)
      if (e.is_dir) {
        const kids = document.createElement('div')
        container.append(kids)
        if (expanded.has(e.path)) void renderDir(kids, e.path, depth + 1)
        row.onclick = () => {
          if (expanded.has(e.path)) { expanded.delete(e.path); kids.replaceChildren() }
          else { expanded.add(e.path); void renderDir(kids, e.path, depth + 1) }
          label()
        }
      } else {
        row.onclick = () => onOpen(e.path)
      }
    }
  }

  async function refresh() {
    if (!workspace.root) { host.textContent = '  NO WORKSPACE'; return }
    await renderDir(host, '', 0)
  }

  return { refresh, reset() { expanded.clear(); void refresh() } }
}
