const BOUNDARY = '/_-. '

/** Subsequence match score; null when `query` is not a subsequence of `text`. */
export function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0
  const q = query.toLowerCase(), t = text.toLowerCase()
  let score = 0, from = 0, prev = -2
  for (const ch of q) {
    const i = t.indexOf(ch, from)
    if (i === -1) return null
    score += 1
    if (i === prev + 1) score += 5
    if (i === 0 || BOUNDARY.includes(t[i - 1])) score += 3
    prev = i
    from = i + 1
  }
  // whole-segment bonus: the match ends at a word boundary ("edit" in "src/edit/x")
  if (prev + 1 === t.length || BOUNDARY.includes(t[prev + 1])) score += 2
  return score - t.length * 0.01
}

export function fuzzyFilter<T>(items: T[], query: string, key: (t: T) => string, limit = 200): T[] {
  if (!query) return items.slice(0, limit)
  const scored: Array<[number, T]> = []
  for (const it of items) {
    const s = fuzzyScore(query, key(it))
    if (s !== null) scored.push([s, it])
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, it]) => it)
}
