interface ModalOpts { title: string; message: string; danger?: boolean }
type Val<T> = T | (() => T)
interface ModalSpec<T> { buttons: Array<[act: string, label: string, value: Val<T>]>; cancel: T; enter?: () => T; focus?: HTMLElement }

const resolveVal = <T,>(v: Val<T>): T => (typeof v === 'function' ? (v as () => T)() : v)

function modal<T>(o: ModalOpts, build: (box: HTMLElement) => ModalSpec<T>): Promise<T> {
  return new Promise(resolve => {
    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'
    const box = document.createElement('div')
    box.className = 'modal' + (o.danger ? ' danger' : '')
    const title = document.createElement('div'); title.className = 'modal-title'; title.textContent = o.title
    const msg = document.createElement('div'); msg.className = 'modal-msg'; msg.textContent = o.message
    box.append(title, msg)
    const spec = build(box)
    const row = document.createElement('div'); row.className = 'modal-btns'
    const done = (v: T) => { backdrop.remove(); resolve(v) }
    for (const [act, label, value] of spec.buttons) {
      const b = document.createElement('button'); b.dataset.act = act; b.textContent = label
      b.onclick = () => done(resolveVal(value))
      row.append(b)
    }
    box.append(row)
    backdrop.append(box)
    backdrop.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(spec.cancel) }
      else if (e.key === 'Enter' && spec.enter) { e.preventDefault(); e.stopPropagation(); done(spec.enter()) }
    })
    document.body.append(backdrop)
    ;(spec.focus ?? (row.querySelector('[data-act=ok]') as HTMLElement | null))?.focus()
  })
}

export function confirmDialog(o: ModalOpts & { ok?: string; cancel?: string }): Promise<boolean> {
  return modal<boolean>(o, () => ({
    buttons: [['cancel', `[ ${o.cancel ?? 'CANCEL'} ]`, false], ['ok', `[ ${o.ok ?? 'OK'} ]`, true]],
    cancel: false,
    enter: () => true,
  }))
}

export function promptDialog(o: ModalOpts & { value?: string }): Promise<string | null> {
  const input = document.createElement('input')
  input.value = o.value ?? ''
  input.spellcheck = false
  const read = () => input.value.trim() || null
  return modal<string | null>(o, box => {
    box.append(input)
    setTimeout(() => input.select())
    return { buttons: [['cancel', '[ CANCEL ]', null], ['ok', '[ OK ]', read]], cancel: null, enter: read, focus: input }
  })
}

export function fault(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[SYSTEM FAULT]', err)
  void modal<string>({ title: '▓ SYSTEM FAULT ▓', message, danger: true }, () => ({
    buttons: [['copy', '[ COPY ]', 'copy'], ['ok', '[ OK ]', 'ok']],
    cancel: 'ok',
    enter: () => 'ok',
  })).then(v => { if (v === 'copy') void navigator.clipboard?.writeText(message).catch(() => {}) })
}

export function toast(msg: string, ms = 3500): void {
  let tray = document.querySelector('.toasts') as HTMLElement | null
  if (!tray) { tray = document.createElement('div'); tray.className = 'toasts'; document.body.append(tray) }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg
  tray.append(t)
  setTimeout(() => t.remove(), ms)
}

export async function guarded<T>(p: Promise<T>): Promise<T | undefined> {
  try { return await p } catch (e) { fault(e); return undefined }
}
