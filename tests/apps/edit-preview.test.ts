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

describe('markdown preview attributes', () => {
  it('drops class/id (no borrowing app CSS) and image-map links', async () => {
    const html = await renderMarkdown('<div class="modal-backdrop" id="x">fake</div><img src="a.png" usemap="#m"><map name="m"><area href="https://evil.example/"></map>\n\n[ok](https://example.com)')
    expect(html).not.toMatch(/class=|id=|<area|<map|usemap/)
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('src="a.png"')
  })
})
