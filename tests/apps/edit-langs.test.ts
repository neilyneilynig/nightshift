import { describe, it, expect } from 'vitest'
import { langKey, loadLanguage } from '../../src/apps/edit/langs'

describe('langs', () => {
  it('maps extensions and special names', () => {
    expect(langKey('src/main.ts')).toBe('ts')
    expect(langKey('App.tsx')).toBe('tsx')
    expect(langKey('src-tauri/src/fs.rs')).toBe('rust')
    expect(langKey('README.MD')).toBe('markdown')
    expect(langKey('Cargo.toml')).toBe('toml')
    expect(langKey('.bashrc')).toBe('shell')
    expect(langKey('LICENSE')).toBeNull()
  })
  it('loads a language extension', async () => {
    expect(await loadLanguage('rust')).not.toBeNull()
    expect(await loadLanguage(null)).toBeNull()
  })
})
