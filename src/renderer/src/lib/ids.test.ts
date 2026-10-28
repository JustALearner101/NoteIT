import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from './ids'

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('memakai prefix yang diminta', () => {
    expect(createId('blk').startsWith('blk-')).toBe(true)
    expect(createId('cn').startsWith('cn-')).toBe(true)
    expect(createId('tsk').startsWith('tsk-')).toBe(true)
  })

  it('1000 pemanggilan tidak menghasilkan duplikat', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i += 1) ids.add(createId('blk'))
    expect(ids.size).toBe(1000)
  })

  it('fallback tetap unik saat crypto.randomUUID tidak tersedia', () => {
    vi.stubGlobal('crypto', {} as Crypto)

    const ids = new Set<string>()
    for (let i = 0; i < 1000; i += 1) ids.add(createId('cn'))

    expect(ids.size).toBe(1000)
    expect(Array.from(ids)[0].startsWith('cn-')).toBe(true)
  })
})

