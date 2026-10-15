export class TabList {
  paths: string[] = []
  private active = -1

  open(path: string): number {
    let i = this.paths.indexOf(path)
    if (i === -1) { this.paths.push(path); i = this.paths.length - 1 }
    this.active = i
    return i
  }

  /** remove a tab; returns the path that should now be shown */
  close(path: string): string | null {
    const i = this.paths.indexOf(path)
    if (i === -1) return this.current()
    this.paths.splice(i, 1)
    if (!this.paths.length) { this.active = -1; return null }
    if (i < this.active) this.active--
    else if (i === this.active) this.active = Math.min(i, this.paths.length - 1)
    return this.current()
  }

  current(): string | null { return this.active >= 0 ? this.paths[this.active] : null }
}
