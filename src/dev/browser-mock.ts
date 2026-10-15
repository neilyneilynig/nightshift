// Dev-only stand-in for the Tauri backend so the UI can be previewed in a plain
// browser (`npm run dev`). Never loaded inside the Tauri app.

const files = new Map<string, string>([
  ['README.md', '# NIGHTSHIFT//OS\n\nBrowser preview with a **mock** backend.\n'],
  ['src/main.ts', "console.log('jack in')\n"],
  ['src/wm/wm.ts', 'export class WindowManager {}\n'],
  ['Cargo.toml', '[package]\nname = "demo"\n'],
])
const mtimes = new Map<string, number>()
const callbacks = new Map<number, (e: unknown) => void>()
const listeners = new Map<string, number[]>()
let nextCb = 1
let nextPty = 1
let root: string | null = null

const stat = (path: string) => ({ mtime_ms: mtimes.get(path) ?? 1, size: files.get(path)?.length ?? 0, is_dir: !files.has(path) })
const emit = (event: string, payload: unknown) => (listeners.get(event) ?? []).forEach(id => callbacks.get(id)?.({ event, id: 0, payload }))
const bytes = (s: string) => [...new TextEncoder().encode(s)]

function list(dir: string) {
  const prefix = dir ? `${dir}/` : ''
  const seen = new Map<string, boolean>()
  for (const p of files.keys()) {
    if (!p.startsWith(prefix)) continue
    const rest = p.slice(prefix.length)
    const [head, ...more] = rest.split('/')
    seen.set(head, more.length > 0 || seen.get(head) === true)
  }
  return [...seen].map(([name, is_dir]) => ({ name, path: prefix + name, is_dir }))
    .sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name))
}

const handlers: Record<string, (a: any) => unknown> = {
  ws_open: a => (root = a.path),
  ws_root: () => root,
  fs_list: a => list(a.path),
  fs_read: a => { if (!files.has(a.path)) throw `${a.path}: not found`; return files.get(a.path) },
  fs_write: a => { files.set(a.path, a.content); mtimes.set(a.path, Date.now()); return stat(a.path) },
  fs_stat: a => { if (!files.has(a.path) && !list(a.path).length) throw `${a.path}: not found`; return stat(a.path) },
  fs_mkdir: () => null,
  fs_rename: a => { files.set(a.to, files.get(a.from) ?? ''); files.delete(a.from); return null },
  fs_delete: a => { files.delete(a.path); return null },
  search_files: () => [...files.keys()],
  search_text: a => [...files].flatMap(([path, text]) => text.split('\n').flatMap((t, i) => (t.includes(a.query) ? [{ path, line: i + 1, text: t }] : []))),
  state_load: () => ({ state: null, warning: null }),
  state_save: () => null,
  pty_spawn: () => { const id = nextPty++; setTimeout(() => emit('pty-data', { id, data: bytes('mock shell ─ input is echoed\r\n$ ') })); return id },
  pty_write: a => { emit('pty-data', { id: a.id, data: bytes(a.data === '\r' ? '\r\n$ ' : a.data) }); return null },
  pty_resize: () => null,
  pty_kill: () => null,
  'plugin:event|listen': a => { listeners.set(a.event, [...(listeners.get(a.event) ?? []), a.handler]); return a.handler },
  'plugin:event|unlisten': () => null,
  'plugin:dialog|open': () => '/demo',
  'plugin:clipboard-manager|read_text': () => '',
  'plugin:clipboard-manager|write_text': () => null,
  'plugin:opener|open_url': a => { window.open(a.url, '_blank'); return null },
}

;(window as any).__TAURI_INTERNALS__ = {
  metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  transformCallback(cb: (e: unknown) => void) { const id = nextCb++; callbacks.set(id, cb); return id },
  unregisterCallback(id: number) { callbacks.delete(id) },
  async invoke(cmd: string, args: unknown) {
    const h = handlers[cmd]
    if (!h) throw `mock backend: no handler for ${cmd}`
    return h(args ?? {})
  },
}
console.info('[nightshift] browser preview: mock backend active')
export {}
