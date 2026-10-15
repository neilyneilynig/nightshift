import './style.css'
import { bus } from './kernel/bus'
import { commands } from './kernel/commands'
import { installHotkeys } from './kernel/hotkeys'
import { createRegistry } from './kernel/registry'
import type { AppManifest } from './kernel/types'
import { restore, startPersistence } from './persist'
import { fault, guarded, toast } from './system/dialog'
import { workspace } from './workspace'
import { mountIcons } from './wm/desktop'
import { toggleJack } from './wm/jack'
import { mountTaskbar } from './wm/taskbar'
import { NODES, WindowManager } from './wm/wm'

if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) await import('./dev/browser-mock')

window.addEventListener('unhandledrejection', e => fault(e.reason))

const wm = new WindowManager(document.querySelector('#windows') as HTMLElement, bus)
const registry = createRegistry(wm, bus)

// later tasks append app manifests here
const apps: AppManifest[] = []
apps.forEach(a => registry.register(a))

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const onFocused = (fn: (id: number) => void) => () => { const f = wm.focused(); if (f) fn(f.id) }

commands.add({ id: 'workspace.open', title: 'Open workspace…', hint: 'Ctrl+Alt+O', run: () => void guarded(workspace.pick()) })
commands.add({ id: 'wm.tile', title: 'Tile windows', hint: 'Ctrl+Alt+G', run: () => wm.tileAll() })
commands.add({ id: 'wm.close', title: 'Close window', hint: 'Ctrl+Alt+W', run: () => void wm.focused()?.close() })
commands.add({ id: 'wm.min', title: 'Minimize window', hint: 'Ctrl+Alt+M', run: onFocused(id => wm.minimize(id)) })
for (const dir of ['left', 'right', 'up', 'down'] as const) {
  commands.add({ id: `wm.snap.${dir}`, title: `Snap window ${dir}`, hint: `Ctrl+Alt+${cap(dir)}`, run: onFocused(id => wm.snap(id, dir)) })
}
for (let n = 1; n <= NODES; n++) {
  commands.add({ id: `node.${n}`, title: `Switch to node ${n}`, hint: `Ctrl+Alt+${n}`, run: () => wm.setNode(n) })
  commands.add({ id: `node.move.${n}`, title: `Move window to node ${n}`, hint: `Ctrl+Alt+Shift+${n}`, run: onFocused(id => wm.moveToNode(id, n)) })
}

installHotkeys(window, [
  ...commands.list().filter(c => c.hint).map(c => ({ combo: c.hint!, run: c.run })),
  ...registry.list().filter(a => a.hotkey).map(a => ({ combo: a.hotkey!, run: () => void registry.launch(a.id) })),
])

mountTaskbar(document.querySelector('#taskbar') as HTMLElement, wm, bus, anchor => toggleJack(anchor, registry, [
  { label: 'Open workspace…', run: () => commands.get('workspace.open')!.run() },
  { label: 'Tile windows', run: () => wm.tileAll() },
]))
mountIcons(document.querySelector('#icons') as HTMLElement, registry)

bus.on('file:open', p => { if (registry.get('edit')) registry.launch('edit', { open: p }) })
window.addEventListener('resize', () => wm.reflow())

await restore(registry, wm).catch(fault)
if (!workspace.root) toast('NO WORKSPACE JACKED IN ─ Ctrl+Alt+O to open a folder', 6000)
startPersistence(wm, bus)
