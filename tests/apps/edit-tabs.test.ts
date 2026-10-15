import { describe, it, expect } from 'vitest'
import { TabList } from '../../src/apps/edit/tabs'

describe('TabList', () => {
  it('does not duplicate and activates on open', () => {
    const t = new TabList()
    t.open('a'); t.open('b'); t.open('a')
    expect(t.paths).toEqual(['a', 'b'])
    expect(t.current()).toBe('a')
  })
  it('closing the active tab activates a neighbour; closing others keeps active', () => {
    const t = new TabList()
    t.open('a'); t.open('b'); t.open('c')
    expect(t.close('c')).toBe('b')
    t.open('a')
    expect(t.close('b')).toBe('a')
    expect(t.close('a')).toBeNull()
    expect(t.current()).toBeNull()
  })
})
