import { describe, it, expect } from 'vitest'
import { Text } from '@codemirror/state'
import { externalAction, stillDirty } from '../../src/apps/edit/sync'

describe('edit sync rules', () => {
  it('clean files reload silently; dirty files ask only when EDIT has focus', () => {
    expect(externalAction(false, false)).toBe('reload')
    expect(externalAction(true, true)).toBe('ask')
    expect(externalAction(true, false)).toBe('defer')
  })
  it('a save only clears dirty if nothing was typed while it was in flight', () => {
    const saved = Text.of(['abc'])
    expect(stillDirty(saved, Text.of(['abc']))).toBe(false)
    expect(stillDirty(saved, Text.of(['abcd']))).toBe(true)
  })
})
