import type { Bus } from './bus'
import type { AppManifest, Rect, WinHandle, WindowManagerLike } from './types'

export interface LaunchOpts { rect?: Rect; node?: number; minimized?: boolean }

export function createRegistry(wm: WindowManagerLike, bus: Bus) {
  const apps = new Map<string, AppManifest>()
  return {
    register(m: AppManifest) {
      if (apps.has(m.id)) throw new Error(`duplicate app id ${m.id}`)
      apps.set(m.id, m)
    },
    get(id: string) { return apps.get(id) },
    list(): AppManifest[] { return [...apps.values()] },
    launch(id: string, args?: unknown, opts: LaunchOpts = {}): WinHandle | null {
      const m = apps.get(id)
      if (!m) throw new Error(`unknown app ${id}`)
      if (m.run) { m.run(args); return null }
      if (!m.multi) {
        const existing = wm.findByApp(id)
        if (existing) {
          existing.focus()
          if (args !== undefined) bus.emit(`${id}:args`, args)
          return existing
        }
      }
      const win = wm.create({ appId: id, title: m.name, glyph: m.glyph, size: m.size, ...opts })
      win.setPersist(args ?? null)
      m.open!({ win, bus }, args)
      return win
    },
  }
}

export type Registry = ReturnType<typeof createRegistry>
