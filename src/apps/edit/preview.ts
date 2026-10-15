import DOMPurify from 'dompurify'
import { marked } from 'marked'

// Files are untrusted: no scripts (DOMPurify default), and no styles or form
// controls, classes or image maps, so a document can't paint fake app UI.
const PURIFY = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'map', 'area'],
  // allowlist: no class/id (would borrow app CSS), no style, no usemap
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'align', 'start', 'type', 'checked', 'disabled'],
}

export async function renderMarkdown(src: string): Promise<string> {
  return DOMPurify.sanitize(await marked.parse(src), PURIFY)
}
