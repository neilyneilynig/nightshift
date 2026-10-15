type Sink = (d: Uint8Array) => void

/** Routes pty-data events to terminals; buffers chunks for ids not attached yet. */
export function createPtyRouter() {
  const sinks = new Map<number, Sink>()
  const pending = new Map<number, Uint8Array[]>()
  const closed = new Set<number>()
  return {
    route(id: number, d: Uint8Array) {
      const s = sinks.get(id)
      if (s) s(d)
      else if (!closed.has(id)) { const p = pending.get(id) ?? []; p.push(d); pending.set(id, p) }
    },
    attach(id: number, sink: Sink) {
      sinks.set(id, sink)
      for (const d of pending.get(id) ?? []) sink(d)
      pending.delete(id)
    },
    detach(id: number) { sinks.delete(id); pending.delete(id); closed.add(id) },
    pendingCount() { return pending.size },
  }
}
