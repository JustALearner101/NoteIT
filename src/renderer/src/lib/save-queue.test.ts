import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSaveQueue } from './save-queue'

type Patch = Record<string, unknown>

describe('createSaveQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('menggabungkan beberapa patch pageId sama menjadi satu send', () => {
    const send = vi.fn<(pageId: string, patch: Patch) => void>()
    const queue = createSaveQueue<Patch>({ delayMs: 350, send })

    queue.enqueue('p1', { title: 'Draft' })
    queue.enqueue('p1', { blocks: ['b1'] })
    queue.enqueue('p1', { title: 'Final' })

    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(350)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('p1', { title: 'Final', blocks: ['b1'] })
  })

  it('mengirim patch pageId berbeda secara terpisah', () => {
    const send = vi.fn<(pageId: string, patch: Patch) => void>()
    const queue = createSaveQueue<Patch>({ delayMs: 350, send })

    queue.enqueue('p1', { title: 'Satu' })
    queue.enqueue('p2', { title: 'Dua' })

    vi.advanceTimersByTime(350)

    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledWith('p1', { title: 'Satu' })
    expect(send).toHaveBeenCalledWith('p2', { title: 'Dua' })
  })

  it('me-reset timer hanya untuk pageId yang di-enqueue ulang', () => {
    const send = vi.fn<(pageId: string, patch: Patch) => void>()
    const queue = createSaveQueue<Patch>({ delayMs: 350, send })

    queue.enqueue('p1', { title: 'A' })
    vi.advanceTimersByTime(200)
    queue.enqueue('p1', { title: 'B' })
    vi.advanceTimersByTime(200)

    expect(send).not.toHaveBeenCalled()

    vi.advanceTimersByTime(150)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('p1', { title: 'B' })
  })

  it('flushAll mengirim segera dan mengosongkan antrean', () => {
    const send = vi.fn<(pageId: string, patch: Patch) => void>()
    const queue = createSaveQueue<Patch>({ delayMs: 350, send })

    queue.enqueue('p1', { title: 'A' })
    expect(queue.hasPending('p1')).toBe(true)

    queue.flushAll()

    expect(send).toHaveBeenCalledTimes(1)
    expect(queue.hasPending('p1')).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('cancelAll membuang patch tertunda tanpa mengirim', () => {
    const send = vi.fn<(pageId: string, patch: Patch) => void>()
    const queue = createSaveQueue<Patch>({ delayMs: 350, send })

    queue.enqueue('p1', { title: 'A' })
    queue.enqueue('p2', { title: 'B' })
    queue.cancelAll()

    expect(queue.hasPending('p1')).toBe(false)
    expect(queue.hasPending('p2')).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(send).not.toHaveBeenCalled()
  })
})

