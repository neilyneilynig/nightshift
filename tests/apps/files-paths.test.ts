import { describe, it, expect } from 'vitest'
import { joinRel, parentOf, validName } from '../../src/apps/files/paths'

describe('files paths', () => {
  it('joins and walks up', () => {
    expect(joinRel('', 'a.txt')).toBe('a.txt')
    expect(joinRel('src/apps', 'x')).toBe('src/apps/x')
    expect(parentOf('src/apps')).toBe('src')
    expect(parentOf('src')).toBe('')
    expect(parentOf('')).toBe('')
  })
  it('validates names', () => {
    expect(validName('  ok.ts ')).toBe('ok.ts')
    expect(validName('sub/dir.ts')).toBe('sub/dir.ts')
    expect(validName('')).toBeNull()
    expect(validName('..')).toBeNull()
    expect(validName('a/../b')).toBeNull()
    expect(validName('/abs')).toBeNull()
  })
})
