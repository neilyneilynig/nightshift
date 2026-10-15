import type { Extension } from '@codemirror/state'

export type LangKey = 'ts' | 'tsx' | 'js' | 'jsx' | 'rust' | 'python' | 'html' | 'css' | 'json' | 'markdown' | 'yaml' | 'toml' | 'shell'

const EXT: Record<string, LangKey> = {
  ts: 'ts', mts: 'ts', cts: 'ts', tsx: 'tsx', js: 'js', mjs: 'js', cjs: 'js', jsx: 'jsx',
  rs: 'rust', py: 'python', html: 'html', htm: 'html', css: 'css', json: 'json',
  md: 'markdown', markdown: 'markdown', yml: 'yaml', yaml: 'yaml', toml: 'toml', sh: 'shell', bash: 'shell', zsh: 'shell',
}

export function langKey(path: string): LangKey | null {
  const base = path.split('/').pop() ?? ''
  if (/^\.(bash|zsh)rc$|^\.(bash_)?profile$/.test(base)) return 'shell'
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return null
  return EXT[base.slice(dot + 1).toLowerCase()] ?? null
}

export async function loadLanguage(key: LangKey | null): Promise<Extension | null> {
  switch (key) {
    case 'ts': return (await import('@codemirror/lang-javascript')).javascript({ typescript: true })
    case 'tsx': return (await import('@codemirror/lang-javascript')).javascript({ typescript: true, jsx: true })
    case 'js': return (await import('@codemirror/lang-javascript')).javascript()
    case 'jsx': return (await import('@codemirror/lang-javascript')).javascript({ jsx: true })
    case 'rust': return (await import('@codemirror/lang-rust')).rust()
    case 'python': return (await import('@codemirror/lang-python')).python()
    case 'html': return (await import('@codemirror/lang-html')).html()
    case 'css': return (await import('@codemirror/lang-css')).css()
    case 'json': return (await import('@codemirror/lang-json')).json()
    case 'markdown': return (await import('@codemirror/lang-markdown')).markdown()
    case 'yaml': return (await import('@codemirror/lang-yaml')).yaml()
    case 'toml': {
      const [{ StreamLanguage }, { toml }] = await Promise.all([import('@codemirror/language'), import('@codemirror/legacy-modes/mode/toml')])
      return StreamLanguage.define(toml)
    }
    case 'shell': {
      const [{ StreamLanguage }, { shell }] = await Promise.all([import('@codemirror/language'), import('@codemirror/legacy-modes/mode/shell')])
      return StreamLanguage.define(shell)
    }
    default: return null
  }
}
