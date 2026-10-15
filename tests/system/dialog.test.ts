import { describe, it, expect, beforeEach } from 'vitest'
import { confirmDialog, promptDialog } from '../../src/system/dialog'

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
