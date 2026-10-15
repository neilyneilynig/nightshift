import { ipc, type Hit } from '../../ipc'
import { fuzzyFilter } from '../../kernel/fuzzy'
import type { AppContext, AppManifest } from '../../kernel/types'
import { fault } from '../../system/dialog'

export interface ScanArgs { mode?: 'files' | 'text' }
type Row = { path: string; line?: number; text?: string }

export const scan: AppManifest = {
  id: 'scan', name: 'SCAN', glyph: '?/', category: 'core', multi: false, size: { w: 720, h: 480 },
  open: (ctx, args) => mountScan(ctx, (args ?? {}) as ScanArgs),
}

function mountScan({ win, bus }: AppContext, args: ScanArgs) {
  let mode: 'files' | 'text' = args.mode ?? 'files'
  let rows: Row[] = []
  let sel = 0
  let fileCache: string[] | null = null
  let seq = 0
  let timer: number | undefined

  win.body.classList.add('scan')
  win.body.innerHTML = `<div class="scan-bar"><button class="scan-mode" data-mode="files">FILES</button><button class="scan-mode" data-mode="text">TEXT</button><input spellcheck="false" /></div><div class="scan-status"></div><div class="scan-list"></div>`
  const input = win.body.querySelector('input') as HTMLInputElement
  const status = win.body.querySelector('.scan-status') as HTMLElement
  const list = win.body.querySelector('.scan-list') as HTMLElement

  function setMode(m: 'files' | 'text') {
    mode = m
    win.body.querySelectorAll<HTMLElement>('.scan-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === m))
    input.placeholder = m === 'files' ? 'fuzzy file name… (Tab: text search)' : 'search text in workspace… (Tab: files)'
    win.setTitle(m === 'files' ? 'SCAN ─ FILES' : 'SCAN ─ TEXT')
    win.setPersist({ mode } satisfies ScanArgs)
    schedule(0)
  }

  function schedule(ms = mode === 'files' ? 80 : 250) { clearTimeout(timer); timer = window.setTimeout(() => void run(), ms) }

  async function run() {
    const q = input.value
    const my = ++seq
    try {
      if (mode === 'files') {
        fileCache ??= await ipc.searchFiles()
        if (my !== seq) return
        rows = fuzzyFilter(fileCache, q, s => s, 200).map(path => ({ path }))
        status.textContent = `${rows.length} shown / ${fileCache.length} files${fileCache.length >= 20000 ? ' (index capped at 20000)' : ''}`
      } else if (q.trim().length < 2) {
        rows = []
        status.textContent = 'type 2+ characters'
      } else {
        status.textContent = 'scanning…'
        const hits: Hit[] = await ipc.searchText(q)
        if (my !== seq) return
        rows = hits
        status.textContent = `${hits.length} hits${hits.length >= 500 ? ' (capped at 500)' : ''}`
      }
    } catch (e) {
      if (my !== seq) return
      rows = []
      status.textContent = String(e)
      if (!String(e).includes('NO WORKSPACE')) fault(e)
    }
    sel = 0
    render()
  }

  function render() {
    list.replaceChildren(...rows.map((r, i) => {
      const row = document.createElement('div')
      row.className = 'scan-row' + (i === sel ? ' sel' : '')
      const loc = document.createElement('span'); loc.className = 'loc'
      loc.textContent = r.line ? `${r.path}:${r.line}` : r.path
      row.append(loc)
      if (r.text) row.append(document.createTextNode(r.text.trim()))
      row.onclick = () => pick(r)
      return row
    }))
    list.children[sel]?.scrollIntoView({ block: 'nearest' })
  }

  function pick(r: Row | undefined) { if (r) bus.emit('file:open', { path: r.path, line: r.line }) }

  input.addEventListener('input', () => schedule())
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') sel = Math.min(sel + 1, rows.length - 1)
    else if (e.key === 'ArrowUp') sel = Math.max(sel - 1, 0)
    else if (e.key === 'Enter') { pick(rows[sel]); return }
    else if (e.key === 'Tab') setMode(mode === 'files' ? 'text' : 'files')
    else return
    e.preventDefault()
    render()
  })
  win.body.querySelector('.scan-bar')!.addEventListener('click', e => {
    const m = (e.target as HTMLElement).closest<HTMLElement>('.scan-mode')?.dataset.mode
    if (m === 'files' || m === 'text') { setMode(m); input.focus() }
  })

  const invalidate = () => { fileCache = null; schedule(0) }
  const offWs = bus.on('workspace:changed', invalidate)
  const offFs = bus.on('fs:changed', () => { fileCache = null })
  const offArgs = bus.on('scan:args', a => { setMode((a as ScanArgs)?.mode ?? mode); input.select(); input.focus() })
  win.onFocus(() => input.focus())
  win.onClose(() => { offWs(); offFs(); offArgs(); clearTimeout(timer) })

  setMode(mode)
  input.focus()
}
