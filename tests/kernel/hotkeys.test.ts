import { describe, it, expect, vi } from 'vitest'
import { parseCombo, matches, installHotkeys } from '../../src/kernel/hotkeys'

const ev = (o: Partial<KeyboardEvent>) => ({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, code: '', ...o })

describe('hotkeys', () => {
  it('parses letters, digits and named keys', () => {
    expect(parseCombo('Ctrl+Shift+K')).toEqual({ ctrl: true, alt: false, shift: true, meta: false, code: 'KeyK' })
    expect(parseCombo('Ctrl+Alt+3').code).toBe('Digit3')
    expect(parseCombo('Ctrl+Alt+Left').code).toBe('ArrowLeft')
  })
  it('requires exact modifiers', () => {
    const c = parseCombo('Ctrl+Shift+P')
    expect(matches(ev({ ctrlKey: true, shiftKey: true, code: 'KeyP' }), c)).toBe(true)
    expect(matches(ev({ ctrlKey: true, code: 'KeyP' }), c)).toBe(false)
    expect(matches(ev({ ctrlKey: true, shiftKey: true, altKey: true, code: 'KeyP' }), c)).toBe(false)
  })
  it('installs a capture listener that runs and stops the event', () => {
    const run = vi.fn()
    const off = installHotkeys(window, [{ combo: 'Ctrl+Alt+T', run }])
    const e = new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, code: 'KeyT', cancelable: true })
    window.dispatchEvent(e)
    expect(run).toHaveBeenCalledOnce()
    expect(e.defaultPrevented).toBe(true)
    off()
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, code: 'KeyT' }))
    expect(run).toHaveBeenCalledOnce()
  })
})
