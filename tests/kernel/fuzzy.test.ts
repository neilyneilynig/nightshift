import { describe, it, expect } from 'vitest'
import { fuzzyScore, fuzzyFilter } from '../../src/kernel/fuzzy'

describe('fuzzy', () => {
  it('matches subsequences case-insensitively and rejects misses', () => {
    expect(fuzzyScore('mts', 'src/main.ts')).not.toBeNull()
    expect(fuzzyScore('MAIN', 'src/main.ts')).not.toBeNull()
    expect(fuzzyScore('xyz', 'src/main.ts')).toBeNull()
    expect(fuzzyScore('', 'anything')).toBe(0)
  })
  it('ranks contiguous / word-start matches higher', () => {
    const items = ['src/model/data.ts', 'src/apps/edit/index.ts', 'docs/editorial.md']
    expect(fuzzyFilter(items, 'edit', s => s)[0]).toBe('src/apps/edit/index.ts')
  })
  it('empty query keeps order and applies limit', () => {
    expect(fuzzyFilter(['a', 'b', 'c'], '', s => s, 2)).toEqual(['a', 'b'])
  })
})
