import { commands, type Command } from '../../kernel/commands'
import { fuzzyFilter } from '../../kernel/fuzzy'
import type { Registry } from '../../kernel/registry'
import type { AppManifest } from '../../kernel/types'

export interface Item { title: string; hint: string; glyph: string; run(): void }

export function buildItems(apps: AppManifest[], cmds: Command[], launch: (id: string) => void): Item[] {
  return [
    ...apps.filter(a => a.id !== 'sysop').map(a => ({ title: `Open ${a.name}`, hint: a.hotkey ?? '', glyph: a.glyph, run: () => launch(a.id) })),
    ...cmds.map(c => ({ title: c.title, hint: c.hint ?? '', glyph: '::', run: c.run })),
  ]
}

export function createSysop(registry: Registry): AppManifest {
  let el: HTMLElement | null = null
  const close = () => { el?.remove(); el = null }

  function openPalette() {
    const all = buildItems(registry.list(), commands.list(), id => void registry.launch(id))
    let shown = all
    let sel = 0
    el = document.createElement('div')
    el.className = 'sysop-backdrop'
    el.innerHTML = `<div class="sysop"><div class="sysop-prompt">SYSOP&gt;<input spellcheck="false" placeholder="program or command…" /></div><div class="sysop-list"></div></div>`
    const input = el.querySelector('input') as HTMLInputElement
    const list = el.querySelector('.sysop-list') as HTMLElement
    const exec = (it: Item | undefined) => { if (!it) return; close(); it.run() }
    const render = () => {
      list.replaceChildren(...shown.map((it, i) => {
        const row = document.createElement('div')
        row.className = 'sysop-row' + (i === sel ? ' sel' : '')
        const g = document.createElement('span'); g.className = 'glyph'; g.textContent = it.glyph
        const t = document.createElement('span'); t.textContent = it.title
        const h = document.createElement('span'); h.className = 'hint'; h.textContent = it.hint
        row.append(g, t, h)
        row.onclick = () => exec(it)
        return row
      }))
      list.children[sel]?.scrollIntoView({ block: 'nearest' })
    }
    input.addEventListener('input', () => { shown = fuzzyFilter(all, input.value, i => i.title, 50); sel = 0; render() })
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') sel = Math.min(sel + 1, shown.length - 1)
      else if (e.key === 'ArrowUp') sel = Math.max(sel - 1, 0)
      else if (e.key === 'Enter') { exec(shown[sel]); return }
      else if (e.key === 'Escape') { close(); return }
      else return
      e.preventDefault()
      render()
    })
    el.addEventListener('pointerdown', e => { if (e.target === el) close() })
    document.body.append(el)
    render()
    input.focus()
  }

  return {
    id: 'sysop', name: 'SYSOP CMD', glyph: '>', category: 'system', multi: false, hotkey: 'Ctrl+Shift+K',
    run: () => (el ? close() : openPalette()),
  }
}
