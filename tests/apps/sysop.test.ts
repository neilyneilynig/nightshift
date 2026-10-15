import { describe, it, expect, vi } from 'vitest'
import { buildItems } from '../../src/apps/sysop'
import type { AppManifest } from '../../src/kernel/types'

describe('sysop items', () => {
  it('lists apps (except itself) then commands', () => {
    const launch = vi.fn()
    const apps = [
      { id: 'term', name: 'TERM', glyph: '>_', category: 'core', multi: true, hotkey: 'Ctrl+Alt+T' },
      { id: 'sysop', name: 'SYSOP CMD', glyph: '>', category: 'system', multi: false },
    ] as AppManifest[]
    const run = vi.fn()
    const items = buildItems(apps, [{ id: 'wm.tile', title: 'Tile windows', hint: 'Ctrl+Alt+G', run }], launch)
    expect(items.map(i => i.title)).toEqual(['Open TERM', 'Tile windows'])
    items[0].run()
    expect(launch).toHaveBeenCalledWith('term')
    items[1].run()
    expect(run).toHaveBeenCalled()
  })
})
