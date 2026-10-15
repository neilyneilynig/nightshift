import { indentWithTab } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { openUrl } from '@tauri-apps/plugin-opener'
import { basicSetup } from 'codemirror'
import { ipc } from '../../ipc'
import type { AppContext, AppManifest } from '../../kernel/types'
import { confirmDialog, fault } from '../../system/dialog'
import { workspace } from '../../workspace'
import { phosphorTheme } from './cmtheme'
import { langKey, loadLanguage, type LangKey } from './langs'
import { renderMarkdown } from './preview'
import { TabList } from './tabs'
import { createTree } from './tree'

export interface EditArgs { files?: string[]; active?: string | null; open?: { path: string; line?: number } }

interface Doc { state: EditorState; dirty: boolean; mtime: number; lang: LangKey | null }

export const edit: AppManifest = {
  id: 'edit', name: 'EDIT', glyph: '{}', category: 'core', multi: false, hotkey: 'Ctrl+Alt+E', size: { w: 1000, h: 640 },
  open: (ctx, args) => mountEditor(ctx, (args ?? {}) as EditArgs),
}

const EMPTY = () => EditorState.create({ doc: '', extensions: [phosphorTheme, EditorView.editable.of(false)] })

function mountEditor({ win, bus }: AppContext, initial: EditArgs) {
  win.body.classList.add('edit')
  win.body.innerHTML = `<div class="edit-tree"></div><div class="edit-main"><div class="edit-tabs"></div><div class="edit-panes"><div class="edit-cm"></div><div class="edit-preview hidden"></div></div><div class="edit-status"></div></div>`
  const $ = (s: string) => win.body.querySelector(s) as HTMLElement
  const docs = new Map<string, Doc>()
  const tabs = new TabList()
  let current: string | null = null
  let previewOn = false
  let previewTimer: number | undefined
  let statusMsg = ''

  const view = new EditorView({ parent: $('.edit-cm'), state: EMPTY() })
  const tree = createTree($('.edit-tree'), p => void openPath(p))
  void tree.refresh()

  const dirtyCount = () => [...docs.values()].filter(d => d.dirty).length

  function extensions(path: string, lang: Extension | null): Extension[] {
    return [
      basicSetup,
      keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { void save(); return true } }, indentWithTab]),
      phosphorTheme,
      lang ?? [],
      EditorView.updateListener.of(u => {
        if (u.docChanged) {
          const d = docs.get(path)
          if (d && !d.dirty) { d.dirty = true; renderTabs() }
          schedulePreview()
        }
        if (u.docChanged || u.selectionSet) renderStatus()
      }),
    ]
  }

  async function openPath(path: string, line?: number, quiet = false) {
    if (!docs.has(path)) {
      let text: string, mtime: number
      try {
        const [t, st] = await Promise.all([ipc.read(path), ipc.stat(path)])
        text = t; mtime = st.mtime_ms
      } catch (e) { if (!quiet) fault(e); return }
      const key = langKey(path)
      const lang = await loadLanguage(key).catch(() => null)
      docs.set(path, { state: EditorState.create({ doc: text, extensions: extensions(path, lang) }), dirty: false, mtime, lang: key })
    }
    tabs.open(path)
    show(path)
    if (line) gotoLine(line)
    persist()
  }

  function show(path: string | null) {
    if (current && docs.has(current)) docs.get(current)!.state = view.state
    current = path
    view.setState(path ? docs.get(path)!.state : EMPTY())
    if (!path || docs.get(path)!.lang !== 'markdown') setPreview(false)
    else if (previewOn) void renderPreview()
    statusMsg = ''
    renderTabs(); renderStatus()
    win.setTitle(path ? `EDIT ─ ${path}` : 'EDIT')
    view.focus()
  }

  function gotoLine(line: number) {
    const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines))
    view.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: 'center' }) })
  }

  async function save() {
    if (!current) return
    const path = current
    const d = docs.get(path)!
    try {
      const st = await ipc.stat(path).catch(() => null)
      if (st && st.mtime_ms !== d.mtime) {
        const ok = await confirmDialog({ title: 'SHARD CONFLICT', message: `${path} changed on disk since you opened it.\nOverwrite it with your version?`, ok: 'OVERWRITE', danger: true })
        if (!ok) return
      }
      const out = await ipc.write(path, (path === current ? view.state : d.state).doc.toString())
      d.mtime = out.mtime_ms
      d.dirty = false
      statusMsg = 'SAVED'
      renderTabs(); renderStatus()
      bus.emit('fs:changed', path)
    } catch (e) { fault(e) }
  }

  let checking = false
  async function checkExternal() {
    if (!current || checking) return
    checking = true
    const path = current
    const d = docs.get(path)!
    try {
      const st = await ipc.stat(path).catch(() => null)
      if (!st || st.mtime_ms === d.mtime) return
      d.mtime = st.mtime_ms
      if (d.dirty) {
        const reload = await confirmDialog({ title: 'EXTERNAL WRITE DETECTED', message: `${path} changed on disk.\nReload it and discard your unsaved edits?`, ok: 'RELOAD', cancel: 'KEEP MINE', danger: true })
        if (!reload) return
      }
      const text = await ipc.read(path)
      if (current !== path) return
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
      d.dirty = false
      statusMsg = 'RELOADED'
      renderTabs(); renderStatus()
    } catch (e) { fault(e) } finally { checking = false }
  }

  async function closeTab(path: string) {
    const d = docs.get(path)
    if (!d) return
    if (d.dirty && !(await confirmDialog({ title: 'UNSAVED SHARD', message: `Close ${path} without saving?`, ok: 'DISCARD', danger: true }))) return
    if (current === path) current = null
    docs.delete(path)
    show(tabs.close(path))
    persist()
  }

  function renderTabs() {
    const bar = $('.edit-tabs')
    bar.replaceChildren(...tabs.paths.map(p => {
      const tab = document.createElement('div')
      tab.className = 'tab' + (p === current ? ' active' : '') + (docs.get(p)?.dirty ? ' dirty' : '')
      tab.title = p
      const name = document.createElement('span'); name.className = 'tab-name'; name.textContent = p.split('/').pop()!
      const x = document.createElement('button'); x.textContent = '×'
      x.onclick = e => { e.stopPropagation(); void closeTab(p) }
      tab.onclick = () => { tabs.open(p); show(p); persist() }
      tab.append(name, x)
      return tab
    }))
    if (current && docs.get(current)?.lang === 'markdown') {
      const b = document.createElement('button'); b.className = 'tab-action'; b.textContent = previewOn ? '[ PREVIEW ✓ ]' : '[ PREVIEW ]'
      b.onclick = () => { setPreview(!previewOn); renderTabs() }
      bar.append(b)
    }
  }

  function renderStatus() {
    const s = $('.edit-status')
    if (!current) { s.textContent = 'NO FILE ─ pick one from the tree or Ctrl+Shift+P'; return }
    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head)
    const d = docs.get(current)
    s.textContent = `${current}   Ln ${line.number}, Col ${head - line.from + 1}   ${d?.lang ?? 'text'}   ${d?.dirty ? '● MODIFIED' : ''}   ${statusMsg}`
  }

  function setPreview(on: boolean) {
    previewOn = on
    $('.edit-preview').classList.toggle('hidden', !on)
    if (on) void renderPreview()
  }
  function schedulePreview() {
    if (!previewOn) return
    clearTimeout(previewTimer)
    previewTimer = window.setTimeout(() => void renderPreview(), 200)
  }
  async function renderPreview() { $('.edit-preview').innerHTML = await renderMarkdown(view.state.doc.toString()) }
  $('.edit-preview').addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    e.preventDefault()
    if (/^https?:/.test(a.href)) void openUrl(a.href)
  })

  function persist() { win.setPersist({ files: [...tabs.paths], active: current } satisfies EditArgs) }

  async function handleArgs(a: EditArgs) {
    for (const f of a.files ?? []) await openPath(f, undefined, true)
    if (a.active && docs.has(a.active)) { tabs.open(a.active); show(a.active) }
    if (a.open) await openPath(a.open.path, a.open.line)
  }

  const offArgs = bus.on('edit:args', a => void handleArgs(a as EditArgs))
  const offWs = bus.on('workspace:changed', () => {
    current = null
    docs.clear()
    tabs.paths.splice(0)
    show(tabs.close(''))
    tree.reset()
    persist()
  })
  const offFs = bus.on('fs:changed', () => void tree.refresh())
  const offGuard = workspace.beforeChange(async () => dirtyCount() === 0 || confirmDialog({
    title: 'UNSAVED SHARDS', message: `${dirtyCount()} file(s) in EDIT have unsaved changes.\nSwitch workspace and discard them?`, ok: 'DISCARD', danger: true,
  }))
  const poll = window.setInterval(() => void checkExternal(), 3000)

  win.onFocus(() => { void checkExternal(); view.focus() })
  win.beforeClose(async () => dirtyCount() === 0 || confirmDialog({
    title: 'UNSAVED SHARDS', message: `${dirtyCount()} file(s) have unsaved changes.\nClose EDIT anyway?`, ok: 'DISCARD', danger: true,
  }))
  win.onClose(() => { offArgs(); offWs(); offFs(); offGuard(); clearInterval(poll); clearTimeout(previewTimer); view.destroy() })

  renderTabs(); renderStatus()
  void handleArgs(initial)
}
