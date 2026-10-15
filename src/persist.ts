import { ipc } from './ipc'
import type { Bus } from './kernel/bus'
import type { Registry } from './kernel/registry'
import type { Rect } from './kernel/types'
import { toast } from './system/dialog'
import { workspace } from './workspace'
import { NODES, type WindowManager, type WinState } from './wm/wm'

export interface SavedState { version: 1; workspace: string | null; node: number; windows: WinState[] }

export function buildSaved(windows: WinState[], node: number, ws: string | null): SavedState {
  return { version: 1, workspace: ws, node, windows }
}

const clampNode = (n: unknown) => (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= NODES ? (n as number) : 1)
const isRect = (v: any): v is Rect => !!v && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(v[k]))

export function parseSaved(raw: unknown): SavedState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, any>
  if (r.version !== 1) return null
  const windows: WinState[] = (Array.isArray(r.windows) ? r.windows : [])
    .filter((w: any) => w && typeof w.appId === 'string' && isRect(w.rect))
    .map((w: any) => ({ appId: w.appId, rect: { x: w.rect.x, y: w.rect.y, w: w.rect.w, h: w.rect.h }, node: clampNode(w.node), minimized: !!w.minimized, persist: w.persist ?? null }))
  return { version: 1, workspace: typeof r.workspace === 'string' ? r.workspace : null, node: clampNode(r.node), windows }
}

export async function restore(registry: Registry, wm: WindowManager): Promise<void> {
  const { state, warning } = await ipc.stateLoad()
  if (warning) toast(warning, 8000)
  const saved = parseSaved(state)
  if (!saved) return
  if (saved.workspace) {
    try { await workspace.set(saved.workspace) } catch { toast(`WORKSPACE LOST: ${saved.workspace}`) }
  }
  for (const w of saved.windows) {
    try { registry.launch(w.appId, w.persist ?? undefined, { rect: w.rect, node: w.node, minimized: w.minimized }) }
    catch (e) { console.warn('[restore]', w.appId, e) }
  }
  wm.setNode(saved.node)
}

export function startPersistence(wm: WindowManager, bus: Bus): void {
  let timer: number | undefined
  const save = () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      ipc.stateSave(buildSaved(wm.serialize(), wm.node, workspace.root)).catch(e => console.warn('[persist]', e))
    }, 800)
  }
  for (const ev of ['wm:changed', 'persist:changed', 'workspace:changed']) bus.on(ev, save)
}
