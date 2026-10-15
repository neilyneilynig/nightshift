import { open } from '@tauri-apps/plugin-dialog'
import { ipc } from './ipc'
import { bus } from './kernel/bus'

type Guard = () => Promise<boolean> | boolean
const guards = new Set<Guard>()
let root: string | null = null

export const workspace = {
  get root() { return root },
  name(): string { return root ? root.split('/').filter(Boolean).pop() ?? '/' : 'NO WORKSPACE' },
  beforeChange(g: Guard): () => void { guards.add(g); return () => { guards.delete(g) } },
  async set(path: string): Promise<boolean> {
    for (const g of [...guards]) if (!(await g())) return false
    root = await ipc.wsOpen(path)
    bus.emit('workspace:changed', root)
    return true
  },
  async pick(): Promise<boolean> {
    const dir = await open({ directory: true, multiple: false, title: 'JACK INTO WORKSPACE' })
    return typeof dir === 'string' ? workspace.set(dir) : false
  },
}
