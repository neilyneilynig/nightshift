export const joinRel = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)
export const parentOf = (rel: string) => rel.split('/').slice(0, -1).join('/')

export function validName(raw: string): string | null {
  const name = raw.trim()
  if (!name || name.startsWith('/')) return null
  if (name.split('/').some(p => p === '..' || p === '.' || p === '')) return null
  return name
}
