import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/ipc', () => ({ ipc: {} }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
import { parseSaved, buildSaved } from '../src/persist'

describe('persist', () => {
  it('round-trips a valid state', () => {
    const s = buildSaved([{ appId: 'term', rect: { x: 1, y: 2, w: 400, h: 300 }, node: 2, minimized: false, persist: null }], 2, '/p')
    expect(parseSaved(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })
  it('rejects garbage and drops malformed windows', () => {
    expect(parseSaved(null)).toBeNull()
    expect(parseSaved('x')).toBeNull()
    expect(parseSaved({ version: 99 })).toBeNull()
    const s = parseSaved({ version: 1, workspace: 5, node: 9, windows: [{ appId: 'edit', rect: { x: 0, y: 0, w: 1, h: 1 } }, { appId: 3 }, { appId: 'x', rect: { x: 'a' } }] })!
    expect(s.workspace).toBeNull()
    expect(s.node).toBe(1)
    expect(s.windows).toHaveLength(1)
    expect(s.windows[0]).toEqual({ appId: 'edit', rect: { x: 0, y: 0, w: 1, h: 1 }, node: 1, minimized: false, persist: null })
  })
})
