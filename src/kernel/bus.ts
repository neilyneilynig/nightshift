type Handler = (payload: any) => void

export interface Bus {
  on(ev: string, h: Handler): () => void
  emit(ev: string, payload?: unknown): void
}

export function createBus(): Bus {
  const map = new Map<string, Set<Handler>>()
  return {
    on(ev, h) {
      if (!map.has(ev)) map.set(ev, new Set())
      map.get(ev)!.add(h)
      return () => { map.get(ev)?.delete(h) }
    },
    emit(ev, payload) {
      for (const h of [...(map.get(ev) ?? [])]) {
        try { h(payload) } catch (e) { console.error(`[bus] ${ev}`, e) }
      }
    },
  }
}

export const bus = createBus()
