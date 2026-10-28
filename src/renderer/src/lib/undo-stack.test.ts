import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUndoStack } from './undo-stack'

interface Snapshot {
  value: number
}

describe('createUndoStack', () => {
  let clock = 0

  const tick = (ms: number): void => {
    clock += ms
    vi.setSystemTime(clock)
  }

  beforeEach(() => {
    clock = 1_000_000
    vi.useFakeTimers()
    vi.setSystemTime(clock)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('undo mengembalikan snapshot sebelum perubahan', () => {
    const stack = createUndoStack<Snapshot>({ limit: 50, coalesceMs: 500 })

    stack.push('p1', { value: 0 })
    tick(600)

    expect(stack.canUndo('p1')).toBe(true)
    expect(stack.undo('p1', { value: 1 })).toEqual({ value: 0 })
    expect(stack.canUndo('p1')).toBe(false)
  })

  it('redo mengembalikan state yang dibatalkan', () => {
    const stack = createUndoStack<Snapshot>({ limit: 50, coalesceMs: 500 })

    stack.push('p1', { value: 0 })
    tick(600)
    stack.undo('p1', { value: 1 })

    expect(stack.canRedo('p1')).toBe(true)
    expect(stack.redo('p1')).toEqual({ value: 1 })
    expect(stack.canRedo('p1')).toBe(false)
    expect(stack.canUndo('p1')).toBe(true)
  })

  it('push dalam coalesceMs tidak menambah entri baru', () => {
    const stack = createUndoStack<Snapshot>({ limit: 50, coalesceMs: 500 })

    stack.push('p1', { value: 0 })
    tick(100)
    stack.push('p1', { value: 1 })
    tick(100)
    stack.push('p1', { value: 2 })

    expect(stack.undo('p1', { value: 3 })).toEqual({ value: 0 })
    expect(stack.canUndo('p1')).toBe(false)
  })

  it('membatasi 50 entri dan membuang yang tertua', () => {
    const stack = createUndoStack<Snapshot>({ limit: 50, coalesceMs: 500 })

    for (let i = 0; i < 55; i += 1) {
      stack.push('p1', { value: i })
      tick(600)
    }

    const values: number[] = []
    let restored = stack.undo('p1', { value: 999 })
    while (restored) {
      values.push(restored.value)
      restored = stack.undo('p1')
    }

    expect(values).toHaveLength(50)
    expect(values[0]).toBe(54)
    expect(values[values.length - 1]).toBe(5)
  })

  it('stack tiap pageId terisolasi', () => {
    const stack = createUndoStack<Snapshot>({ limit: 50, coalesceMs: 500 })

    stack.push('p1', { value: 10 })
    tick(600)
    stack.push('p2', { value: 20 })

    expect(stack.undo('p1', { value: 11 })).toEqual({ value: 10 })
    expect(stack.canUndo('p1')).toBe(false)
    expect(stack.undo('p2', { value: 21 })).toEqual({ value: 20 })
    expect(stack.canUndo('p3')).toBe(false)
  })

  it('redo stack dikosongkan saat push baru', () => {
    const stack = createUndoStack<Snapshot>({ limit: 50, coalesceMs: 500 })

    stack.push('p1', { value: 0 })
    tick(600)
    stack.undo('p1', { value: 1 })
    expect(stack.canRedo('p1')).toBe(true)

    stack.push('p1', { value: 2 })

    expect(stack.canRedo('p1')).toBe(false)
  })

  it('clear menghapus riwayat satu halaman', () => {
    const stack = createUndoStack<Snapshot>({ limit: 50, coalesceMs: 500 })

    stack.push('p1', { value: 0 })
    stack.clear('p1')

    expect(stack.canUndo('p1')).toBe(false)
    expect(stack.undo('p1', { value: 1 })).toBeNull()
  })
})

