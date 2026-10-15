import type { Text } from '@codemirror/state'

export type ExternalAction = 'reload' | 'ask' | 'defer'

/** What to do when a file changed on disk: never pop a prompt over another window. */
export function externalAction(dirty: boolean, focused: boolean): ExternalAction {
  if (!dirty) return 'reload'
  return focused ? 'ask' : 'defer'
}

/** After a save, the tab is still dirty if the doc moved on while the write was in flight. */
export function stillDirty(saved: Text, current: Text): boolean {
  return !saved.eq(current)
}
