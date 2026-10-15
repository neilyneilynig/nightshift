import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface Entry { name: string; path: string; is_dir: boolean }
export interface Stat { mtime_ms: number; size: number; is_dir: boolean }
export interface Hit { path: string; line: number; text: string }
export interface PtyData { id: number; data: number[] }
export interface PtyExit { id: number; code: number | null }

export const ipc = {
  wsOpen: (path: string) => invoke<string>('ws_open', { path }),
  wsRoot: () => invoke<string | null>('ws_root'),
  list: (path: string) => invoke<Entry[]>('fs_list', { path }),
  read: (path: string) => invoke<string>('fs_read', { path }),
  write: (path: string, content: string) => invoke<Stat>('fs_write', { path, content }),
  stat: (path: string) => invoke<Stat>('fs_stat', { path }),
  mkdir: (path: string) => invoke<void>('fs_mkdir', { path }),
  rename: (from: string, to: string) => invoke<void>('fs_rename', { from, to }),
  remove: (path: string) => invoke<void>('fs_delete', { path }),
  ptySpawn: (cols: number, rows: number, cwd?: string) => invoke<number>('pty_spawn', { cols, rows, cwd: cwd ?? null }),
  ptyWrite: (id: number, data: string) => invoke<void>('pty_write', { id, data }),
  ptyResize: (id: number, cols: number, rows: number) => invoke<void>('pty_resize', { id, cols, rows }),
  ptyKill: (id: number) => invoke<void>('pty_kill', { id }),
  searchFiles: () => invoke<string[]>('search_files'),
  searchText: (query: string) => invoke<Hit[]>('search_text', { query }),
  stateLoad: () => invoke<{ state: unknown; warning: string | null }>('state_load'),
  stateSave: (state: unknown) => invoke<void>('state_save', { state }),
  onPtyData: (cb: (e: PtyData) => void): Promise<UnlistenFn> => listen<PtyData>('pty-data', ev => cb(ev.payload)),
  onPtyExit: (cb: (e: PtyExit) => void): Promise<UnlistenFn> => listen<PtyExit>('pty-exit', ev => cb(ev.payload)),
}
