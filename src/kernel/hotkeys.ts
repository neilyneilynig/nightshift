export interface Combo { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean; code: string }

type KeyLike = Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'code'>

const NAMED: Record<string, string> = {
  Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown',
  Space: 'Space', Enter: 'Enter', Esc: 'Escape', Tab: 'Tab',
}

export function parseCombo(s: string): Combo {
  const parts = s.split('+')
  const key = parts.pop()!
  const mods = new Set(parts.map(p => p.toLowerCase()))
  const code = NAMED[key]
    ?? (/^[A-Za-z]$/.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : key)
  return { ctrl: mods.has('ctrl'), alt: mods.has('alt'), shift: mods.has('shift'), meta: mods.has('super') || mods.has('meta'), code }
}

export function matches(ev: KeyLike, c: Combo): boolean {
  return ev.code === c.code && ev.ctrlKey === c.ctrl && ev.altKey === c.alt && ev.shiftKey === c.shift && ev.metaKey === c.meta
}

export function installHotkeys(target: Window, bindings: Array<{ combo: string; run: () => void }>): () => void {
  const parsed = bindings.map(b => ({ combo: parseCombo(b.combo), run: b.run }))
  const onKey = (ev: KeyboardEvent) => {
    for (const b of parsed) {
      if (matches(ev, b.combo)) {
        ev.preventDefault()
        ev.stopPropagation()
        b.run()
        return
      }
    }
  }
  target.addEventListener('keydown', onKey, { capture: true })
  return () => target.removeEventListener('keydown', onKey, { capture: true })
}
