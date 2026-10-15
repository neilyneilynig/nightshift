export interface Command { id: string; title: string; hint?: string; run(): void }

const cmds = new Map<string, Command>()

export const commands = {
  add(c: Command) { cmds.set(c.id, c) },
  get(id: string) { return cmds.get(id) },
  list(): Command[] { return [...cmds.values()] },
}
