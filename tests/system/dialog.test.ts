import { describe, it, expect, beforeEach } from 'vitest'
import { confirmDialog, promptDialog, toast } from '../../src/system/dialog'

beforeEach(() => { document.body.innerHTML = '' })
const key = (k: string) => document.querySelector('.modal-backdrop')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))

describe('dialogs', () => {
  it('confirm resolves true on OK, false on Escape, and renders text literally', async () => {
    const p = confirmDialog({ title: 'T', message: '<b>x</b>' })
    expect(document.querySelector('.modal-msg')!.textContent).toBe('<b>x</b>')
    ;(document.querySelector('[data-act=ok]') as HTMLButtonElement).click()
    expect(await p).toBe(true)
    expect(document.querySelector('.modal-backdrop')).toBeNull()
    const q = confirmDialog({ title: 'T', message: 'm' })
    key('Escape')
    expect(await q).toBe(false)
  })
  it('prompt returns the typed value on Enter, null on Escape', async () => {
    const p = promptDialog({ title: 'NEW FILE', message: 'name', value: 'a.ts' })
    const input = document.querySelector('.modal input') as HTMLInputElement
    input.value = 'b.ts'
    key('Enter')
    expect(await p).toBe('b.ts')
    const q = promptDialog({ title: 'x', message: 'y' })
    key('Escape')
    expect(await q).toBeNull()
  })
})

describe('dialog keyboard safety', () => {
  it('Enter activates the focused button, so Enter on CANCEL cancels', async () => {
    const p = confirmDialog({ title: 'DELETE', message: 'x' })
    const cancel = document.querySelector('[data-act=cancel]') as HTMLButtonElement
    cancel.focus()
    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(await p).toBe(false)
  })
  it('danger dialogs focus CANCEL by default', async () => {
    const p = confirmDialog({ title: 'DELETE', message: 'x', danger: true })
    expect((document.activeElement as HTMLElement).dataset.act).toBe('cancel')
    key('Escape')
    await p
  })
  it('toasts never go into a foreign .toasts element (e.g. from a previewed file)', () => {
    const fake = document.createElement('div')
    fake.className = 'toasts'
    document.body.append(fake)
    toast('hello')
    expect(fake.children).toHaveLength(0)
    expect([...document.querySelectorAll('.toast')].some(t => t.textContent === 'hello')).toBe(true)
  })
})
