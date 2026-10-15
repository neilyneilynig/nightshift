import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { openUrl } from '@tauri-apps/plugin-opener'
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { ipc } from '../../ipc'
import type { AppContext, AppManifest } from '../../kernel/types'
import { fault } from '../../system/dialog'
import { MONO, PHOSPHOR as P } from '../../theme'
import { sanitizePaste } from './paste'
import { createPtyRouter } from './router'

export interface TermArgs { cwd?: string; command?: string }

const router = createPtyRouter()
const exits = new Map<number, (code: number | null) => void>()
let wired = false
function wire() {
  if (wired) return
  wired = true
  void ipc.onPtyData(e => router.route(e.id, new Uint8Array(e.data)))
  void ipc.onPtyExit(e => exits.get(e.id)?.(e.code))
}

export const xtermTheme = {
  background: P.bg, foreground: P.fg, cursor: P.bright, cursorAccent: P.bg, selectionBackground: P.sel,
  black: '#0a0f0c', red: P.red, green: P.fg, yellow: P.amber, blue: '#4fa3ff', magenta: P.hot, cyan: P.cyan, white: P.bright,
  brightBlack: P.dim, brightRed: '#ff8080', brightGreen: '#b0ffd0', brightYellow: '#ffd08a', brightBlue: '#8cc4ff', brightMagenta: '#ff9cec', brightCyan: '#9cf8ff', brightWhite: '#ffffff',
}

export const term: AppManifest = {
  id: 'term', name: 'TERM', glyph: '>_', category: 'core', multi: true, hotkey: 'Ctrl+Alt+T', size: { w: 760, h: 460 },
  open: (ctx, args) => { void mountTerminal(ctx, (args ?? {}) as TermArgs) },
}

async function mountTerminal({ win }: AppContext, args: TermArgs) {
  wire()
  win.setPersist({ cwd: args.cwd })
  const host = document.createElement('div')
  host.className = 'term-host'
  const find = document.createElement('div')
  find.className = 'term-find hidden'
  const findInput = document.createElement('input')
  findInput.placeholder = 'find in scrollback'
  find.append(findInput)
  win.body.append(host, find)

  const xterm = new Terminal({ fontFamily: MONO, fontSize: 14, cursorBlink: true, scrollback: 5000, allowProposedApi: true, theme: xtermTheme })
  const fit = new FitAddon()
  const search = new SearchAddon()
  xterm.loadAddon(fit)
  xterm.loadAddon(search)
  xterm.loadAddon(new WebLinksAddon((_e, uri) => { void openUrl(uri) }))
  xterm.open(host)
  fit.fit()

  let id: number | null = null
  const connect = async () => {
    try { id = await ipc.ptySpawn(xterm.cols, xterm.rows, args.cwd) } catch (e) { fault(e); return }
    const myId = id
    exits.set(myId, code => {
      exits.delete(myId); router.detach(myId)
      if (id === myId) id = null
      xterm.write(`\r\n\x1b[31m[NO CARRIER (exit ${code ?? '?'})]\x1b[0m press R to reconnect\r\n`)
    })
    router.attach(myId, d => xterm.write(d))
    if (args.command) void ipc.ptyWrite(myId, args.command + '\n')
  }

  xterm.onData(d => {
    if (id !== null) void ipc.ptyWrite(id, d).catch(() => {})
    else if (d === 'r' || d === 'R') { xterm.reset(); void connect() }
  })
  xterm.attachCustomKeyEventHandler(ev => {
    if (ev.type !== 'keydown' || !ev.ctrlKey || !ev.shiftKey) return true
    if (ev.code === 'KeyF') { find.classList.remove('hidden'); findInput.select(); findInput.focus(); return false }
    if (ev.code === 'KeyC') { const s = xterm.getSelection(); if (s) void writeText(s); return false }
    // xterm.paste() applies bracketed paste when the shell asked for it, then routes through onData
    if (ev.code === 'KeyV') { void readText().then(t => { if (t) xterm.paste(sanitizePaste(t)) }).catch(() => {}); return false }
    return true
  })
  findInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); (e.shiftKey ? search.findPrevious : search.findNext).call(search, findInput.value) }
    else if (e.key === 'Escape') { find.classList.add('hidden'); search.clearDecorations(); xterm.focus() }
  })

  win.onResize(() => {
    try { fit.fit() } catch { return }
    if (id !== null) void ipc.ptyResize(id, xterm.cols, xterm.rows).catch(() => {})
  })
  win.onFocus(() => xterm.focus())
  win.onClose(() => {
    if (id !== null) { const dead = id; id = null; exits.delete(dead); router.detach(dead); void ipc.ptyKill(dead).catch(() => {}) }
    xterm.dispose()
  })

  await connect()
  xterm.focus()
}
