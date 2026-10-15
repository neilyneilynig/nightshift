import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/ipc', () => ({ ipc: { wsOpen: vi.fn(async (p: string) => `/canon${p}`) } }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
import { workspace } from '../src/workspace'
import { bus } from '../src/kernel/bus'

describe('workspace', () => {
  it('sets the canonical root and announces it', async () => {
    const seen = vi.fn()
    bus.on('workspace:changed', seen)
    expect(await workspace.set('/proj')).toBe(true)
    expect(workspace.root).toBe('/canon/proj')
    expect(workspace.name()).toBe('proj')
    expect(seen).toHaveBeenCalledWith('/canon/proj')
  })
  it('workspace guard blocks change', async () => {
    const off = workspace.beforeChange(() => false)
    expect(await workspace.set('/other')).toBe(false)
    expect(workspace.root).toBe('/canon/proj')
    off()
    expect(await workspace.set('/other')).toBe(true)
  })
})
