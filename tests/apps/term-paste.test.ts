import { describe, it, expect } from 'vitest'
import { sanitizePaste } from '../../src/apps/term/paste'

describe('sanitizePaste', () => {
  it('strips escape characters so a paste cannot end bracketed-paste mode early', () => {
    expect(sanitizePaste('ls\x1b[201~\nrm -rf ~\n')).toBe('ls[201~\nrm -rf ~\n')
  })
  it('strips other C0 control characters but keeps tabs and newlines', () => {
    expect(sanitizePaste('a\tb\r\nc\x03\x04')).toBe('a\tb\r\nc')
  })
})
