import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../../src/apps/edit/preview'

describe('markdown preview', () => {
  it('renders markdown and strips scripts/handlers', async () => {
    expect(await renderMarkdown('# Hi')).toContain('<h1')
    const html = await renderMarkdown('<img src=x onerror="alert(1)"><script>alert(2)</script>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })
})

describe('markdown preview containment', () => {
  it('strips inline styles and form controls that could fake app UI', async () => {
    const html = await renderMarkdown('<div style="position:fixed;inset:0">SYSTEM FAULT</div><form><input type="password"><button>OK</button></form><style>body{}</style>')
    expect(html).toContain('SYSTEM FAULT')
    expect(html).not.toContain('style')
    expect(html).not.toMatch(/<(form|input|button)/)
  })
})
