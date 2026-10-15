import DOMPurify from 'dompurify'
import { marked } from 'marked'

export async function renderMarkdown(src: string): Promise<string> {
  return DOMPurify.sanitize(await marked.parse(src))
}
