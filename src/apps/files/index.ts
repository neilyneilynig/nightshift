import { ipc, type Entry } from '../../ipc'
import type { AppContext, AppManifest } from '../../kernel/types'
import { confirmDialog, fault, promptDialog } from '../../system/dialog'
import { workspace } from '../../workspace'
import { joinRel, parentOf, validName } from './paths'

export const files: AppManifest = {
  id: 'files', name: 'FILES', glyph: '/', category: 'system', multi: true, hotkey: 'Ctrl+Alt+F', size: { w: 640, h: 440 },
  open: (ctx, args) => mountFiles(ctx, (args ?? {}) as { cwd?: string }),
}

function mountFiles({ win, bus }: AppContext, args: { cwd?: string }) {
  let cwd = args.cwd ?? ''
  let entries: Entry[] = []
  let sel = -1
  win.body.classList.add('files')
  win.body.innerHTML = `<div class="files-bar"><button data-act="up">↑ UP</button><span class="files-path"></span><span class="spacer"></span><button data-act="file">+FILE</button><button data-act="dir">+DIR</button><button data-act="rename">RENAME</button><button data-act="delete" class="danger">DELETE</button><button data-act="refresh">⟳</button></div><div class="files-list" tabindex="0"></div>`
  const list = win.body.querySelector('.files-list') as HTMLElement
  const pathEl = win.body.querySelector('.files-path') as HTMLElement

  async function load() {
    pathEl.textContent = `${workspace.name()}/${cwd}`
    if (!workspace.root) { list.textContent = '  NO WORKSPACE ─ Ctrl+Alt+O'; entries = []; return }
    try { entries = await ipc.list(cwd) } catch (e) { list.textContent = `  ${String(e)}`; entries = []; return }
    sel = Math.min(sel, entries.length - 1)
    render()
  }

  function render() {
    list.replaceChildren(...entries.map((e, i) => {
      const row = document.createElement('div')
      row.className = 'files-row' + (e.is_dir ? ' dir' : '') + (i === sel ? ' sel' : '')
      const g = document.createElement('span'); g.className = 'g'; g.textContent = e.is_dir ? '[DIR]' : '[---]'
      const n = document.createElement('span'); n.className = 'name'; n.textContent = e.name
      row.append(g, n)
      row.onclick = () => { sel = i; render() }
      row.ondblclick = () => activate(e)
      return row
    }))
  }

  function cd(rel: string) { cwd = rel; sel = -1; win.setPersist({ cwd }); void load() }
  function activate(e: Entry) { if (e.is_dir) cd(e.path); else bus.emit('file:open', { path: e.path }) }
  const changed = (path: string) => bus.emit('fs:changed', path)

  async function act(a: string) {
    const cur = entries[sel]
    try {
      if (a === 'up') cd(parentOf(cwd))
      else if (a === 'refresh') await load()
      else if (a === 'file' || a === 'dir') {
        const raw = await promptDialog({ title: a === 'file' ? 'NEW FILE' : 'NEW DIRECTORY', message: `Name (inside /${cwd})` })
        if (raw === null) return
        const name = validName(raw)
        if (!name) { fault(`Invalid name: ${raw}`); return }
        const path = joinRel(cwd, name)
        if (await ipc.stat(path).then(() => true, () => false)) { fault(`${path} already exists`); return }
        if (a === 'file') { await ipc.write(path, ''); changed(path); bus.emit('file:open', { path }) }
        else { await ipc.mkdir(path); changed(path) }
      } else if (a === 'rename' && cur) {
        const raw = await promptDialog({ title: 'RENAME', message: cur.path, value: cur.name })
        if (raw === null) return
        const name = validName(raw)
        if (!name) { fault(`Invalid name: ${raw}`); return }
        await ipc.rename(cur.path, joinRel(cwd, name))
        changed(cur.path)
      } else if (a === 'delete' && cur) {
        const ok = await confirmDialog({ title: 'DELETE', message: `Permanently delete ${cur.path}${cur.is_dir ? ' and everything inside it' : ''}?`, ok: 'DELETE', danger: true })
        if (!ok) return
        await ipc.remove(cur.path)
        changed(cur.path)
      }
    } catch (e) { fault(e) }
  }

  win.body.querySelector('.files-bar')!.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.act
    if (a) void act(a)
  })
  list.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') sel = Math.min(sel + 1, entries.length - 1)
    else if (e.key === 'ArrowUp') sel = Math.max(sel - 1, 0)
    else if (e.key === 'Enter' && entries[sel]) activate(entries[sel])
    else if (e.key === 'Backspace') cd(parentOf(cwd))
    else if (e.key === 'Delete') void act('delete')
    else if (e.key === 'F2') void act('rename')
    else return
    e.preventDefault()
    render()
  })

  const offFs = bus.on('fs:changed', () => void load())
  const offWs = bus.on('workspace:changed', () => cd(''))
  win.onFocus(() => list.focus())
  win.onClose(() => { offFs(); offWs() })
  void load()
}
