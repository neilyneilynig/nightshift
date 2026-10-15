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
