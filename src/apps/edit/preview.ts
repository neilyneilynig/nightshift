import DOMPurify from 'dompurify'
import { marked } from 'marked'

// Files are untrusted: no scripts (DOMPurify default), and no styles or form
// controls either, so a document can't paint fake app UI over the desktop.
const PURIFY = {
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style'],
}

export async function renderMarkdown(src: string): Promise<string> {
  return DOMPurify.sanitize(await marked.parse(src), PURIFY)
}
