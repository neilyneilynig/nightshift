import type { Bus } from './bus'

export type Category = 'core' | 'netrun' | 'tools' | 'system' | 'street' | 'doors'

export interface Rect { x: number; y: number; w: number; h: number }

export interface WinHandle {
  id: number
  appId: string
  body: HTMLElement
  setTitle(title: string): void
  /** args saved with the layout and passed back to open() on restore */
  setPersist(args: unknown): void
  focus(): void
  /** runs beforeClose guards; resolves false if a guard vetoed */
  close(): Promise<boolean>
  onClose(cb: () => void): void
  onResize(cb: () => void): void
  onFocus(cb: () => void): void
  beforeClose(guard: () => Promise<boolean> | boolean): void
}

export interface AppContext { win: WinHandle; bus: Bus }

export interface AppManifest {
  id: string
  name: string
  glyph: string
  category: Category
  hotkey?: string
  multi: boolean
  size?: { w: number; h: number }
  /** window apps: ctx.win is created before open() is called */
  open?(ctx: AppContext, args?: unknown): void
  /** overlay apps: no window */
  run?(args?: unknown): void
}

export interface CreateOpts {
  appId: string
  title: string
  glyph: string
  size?: { w: number; h: number }
  rect?: Rect
  node?: number
  minimized?: boolean
}

export interface WindowManagerLike {
  create(opts: CreateOpts): WinHandle
  findByApp(appId: string): WinHandle | undefined
}
