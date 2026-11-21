import { describe, expect, it } from 'vitest'
import { createId } from './ids'

describe('createId', () => {
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
})

