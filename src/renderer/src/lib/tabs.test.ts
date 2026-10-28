import { describe, expect, it } from 'vitest'
import {
  MAX_REOPEN_STACK,
  SPLIT_RATIO_DEFAULT,
  closeOthers,
  closeTabIds,
  closeToRight,
  clampSplitRatio,
  nextTabId,
  parseTabs,
  popReopen,
  pruneTabs,
  pushReopen,
  reorderTabs,
  serializeTabs,
  TABS_STORAGE_VERSION
} from './tabs'

const IDS = ['a', 'b', 'c', 'd']

describe('reorderTabs', () => {
  it('memindahkan tab ke kanan', () => {
    expect(reorderTabs(IDS, 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('memindahkan tab ke kiri', () => {
    expect(reorderTabs(IDS, 'd', 'a')).toEqual(['d', 'a', 'b', 'c'])
  })

  it('id sama = tidak berubah (referensi sama)', () => {
    expect(reorderTabs(IDS, 'b', 'b')).toBe(IDS)
  })

  it('id tidak dikenal = tidak berubah', () => {
    expect(reorderTabs(IDS, 'zz', 'a')).toBe(IDS)
    expect(reorderTabs(IDS, 'a', 'zz')).toBe(IDS)
  })

  it('tidak memutasi array input', () => {
    const input = ['a', 'b', 'c']
    reorderTabs(input, 'c', 'a')
    expect(input).toEqual(['a', 'b', 'c'])
  })
})

describe('closeTabIds', () => {
  it('menutup tab non-aktif tanpa mengubah tab aktif', () => {
    expect(closeTabIds(IDS, 'a', 'c')).toEqual({ ids: ['a', 'b', 'd'], activeId: 'a' })
  })

  it('menutup tab aktif memilih tetangga kanan', () => {
    expect(closeTabIds(IDS, 'b', 'b')).toEqual({ ids: ['a', 'c', 'd'], activeId: 'c' })
  })

  it('menutup tab aktif paling kanan memilih tetangga kiri', () => {
    expect(closeTabIds(IDS, 'd', 'd')).toEqual({ ids: ['a', 'b', 'c'], activeId: 'c' })
  })

  it('menutup satu-satunya tab tidak melakukan apa pun', () => {
    expect(closeTabIds(['a'], 'a', 'a')).toEqual({ ids: ['a'], activeId: 'a' })
  })

  it('id tidak dikenal tidak mengubah apa pun', () => {
    const result = closeTabIds(IDS, 'a', 'zz')
    expect(result.ids).toBe(IDS)
    expect(result.activeId).toBe('a')
  })

  it('menutup tab pertama yang aktif jatuh ke tab pertama sisa', () => {
    expect(closeTabIds(['a', 'b'], 'a', 'a')).toEqual({ ids: ['b'], activeId: 'b' })
  })
})

describe('closeOthers', () => {
  it('menyisakan hanya tab yang dipertahankan', () => {
    expect(closeOthers(IDS, 'c')).toEqual(['c'])
  })

  it('keepId tidak dikenal = tidak berubah', () => {
    expect(closeOthers(IDS, 'zz')).toBe(IDS)
  })
})

describe('closeToRight', () => {
  it('menutup semua tab di kanan', () => {
    expect(closeToRight(IDS, 'b')).toEqual(['a', 'b'])
  })

  it('tab paling kanan = tidak berubah', () => {
    expect(closeToRight(IDS, 'd')).toBe(IDS)
  })

  it('id tidak dikenal = tidak berubah', () => {
    expect(closeToRight(IDS, 'zz')).toBe(IDS)
  })
})

describe('nextTabId', () => {
  it('maju satu tab', () => {
    expect(nextTabId(IDS, 'b', 1)).toBe('c')
  })

  it('wrap dari tab terakhir ke pertama', () => {
    expect(nextTabId(IDS, 'd', 1)).toBe('a')
  })

  it('mundur satu tab', () => {
    expect(nextTabId(IDS, 'b', -1)).toBe('a')
  })

  it('wrap dari tab pertama ke terakhir', () => {
    expect(nextTabId(IDS, 'a', -1)).toBe('d')
  })

  it('delta 0 = tetap', () => {
    expect(nextTabId(IDS, 'c', 0)).toBe('c')
  })

  it('delta lebih besar dari jumlah tab tetap di dalam rentang', () => {
    expect(nextTabId(IDS, 'a', 9)).toBe('b')
  })

  it('daftar kosong = string kosong', () => {
    expect(nextTabId([], 'a', 1)).toBe('')
  })

  it('activeId tidak ada di daftar jatuh ke ujung sesuai arah', () => {
    expect(nextTabId(IDS, 'zz', 1)).toBe('a')
    expect(nextTabId(IDS, 'zz', -1)).toBe('d')
  })
})

describe('pruneTabs', () => {
  it('membuang id yang tidak valid', () => {
    expect(pruneTabs(['a', 'x', 'b'], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('membuang duplikat', () => {
    expect(pruneTabs(['a', 'a', 'b'], new Set(['a', 'b']))).toEqual(['a', 'b'])
  })

  it('semua valid = referensi sama', () => {
    expect(pruneTabs(IDS, IDS)).toBe(IDS)
  })

  it('semua tidak valid = array kosong', () => {
    expect(pruneTabs(['x', 'y'], ['a'])).toEqual([])
  })
})

describe('clampSplitRatio', () => {
  it('menjepit batas bawah', () => {
    expect(clampSplitRatio(0.05)).toBe(0.2)
  })

  it('menjepit batas atas', () => {
    expect(clampSplitRatio(0.95)).toBe(0.8)
  })

  it('nilai di dalam rentang dipertahankan', () => {
    expect(clampSplitRatio(0.33)).toBe(0.33)
  })

  it('NaN jatuh ke default', () => {
    expect(clampSplitRatio(Number.NaN)).toBe(SPLIT_RATIO_DEFAULT)
  })
})

describe('serializeTabs / parseTabs', () => {
  const state = {
    openTabIds: ['a', 'b'],
    activePageId: 'b',
    splitPageId: 'a',
    splitRatio: 0.4
  }

  it('round-trip mengembalikan state yang sama', () => {
    expect(parseTabs(serializeTabs(state), IDS)).toEqual(state)
  })

  it('menyimpan versi skema', () => {
    expect(JSON.parse(serializeTabs(state)).v).toBe(TABS_STORAGE_VERSION)
  })

  it('ratio di luar rentang dijepit saat serialisasi', () => {
    const parsed = JSON.parse(serializeTabs({ ...state, splitRatio: 0.99 }))
    expect(parsed.splitRatio).toBe(0.8)
  })

  it('JSON rusak = null', () => {
    expect(parseTabs('{bukan json', IDS)).toBeNull()
  })

  it('null / string kosong = null', () => {
    expect(parseTabs(null, IDS)).toBeNull()
    expect(parseTabs('', IDS)).toBeNull()
  })

  it('versi beda = null', () => {
    expect(parseTabs(JSON.stringify({ ...JSON.parse(serializeTabs(state)), v: 2 }), IDS)).toBeNull()
  })

  it('bentuk salah = null', () => {
    expect(parseTabs(JSON.stringify({ v: 1, openTabIds: 'a' }), IDS)).toBeNull()
    expect(parseTabs(JSON.stringify({ v: 1, openTabIds: ['a'], activePageId: 1 }), IDS)).toBeNull()
    expect(parseTabs(JSON.stringify({ v: 1, openTabIds: ['a'], activePageId: 'a', splitPageId: 5, splitRatio: 0.5 }), IDS)).toBeNull()
    expect(parseTabs(JSON.stringify([1, 2]), IDS)).toBeNull()
  })

  it('semua id tidak valid = null', () => {
    expect(parseTabs(serializeTabs({ ...state, openTabIds: ['x', 'y'], activePageId: 'x' }), IDS)).toBeNull()
  })

  it('id tidak valid sebagian dipangkas', () => {
    const parsed = parseTabs(
      serializeTabs({ ...state, openTabIds: ['a', 'x', 'b'], activePageId: 'b' }),
      IDS
    )
    expect(parsed?.openTabIds).toEqual(['a', 'b'])
    expect(parsed?.activePageId).toBe('b')
  })

  it('activePageId hilang jatuh ke tab pertama', () => {
    const parsed = parseTabs(
      serializeTabs({ ...state, openTabIds: ['a', 'b'], activePageId: 'x' }),
      IDS
    )
    expect(parsed?.activePageId).toBe('a')
  })

  it('splitPageId tidak valid jadi null', () => {
    const parsed = parseTabs(serializeTabs({ ...state, splitPageId: 'x' }), IDS)
    expect(parsed?.splitPageId).toBeNull()
  })

  it('splitRatio tidak wajar dijepit saat dibaca', () => {
    const parsed = parseTabs(
      JSON.stringify({ v: 1, openTabIds: ['a'], activePageId: 'a', splitPageId: null, splitRatio: 3 }),
      IDS
    )
    expect(parsed?.splitRatio).toBe(0.8)
  })
})

describe('reopen stack', () => {
  it('push menambah di ujung', () => {
    expect(pushReopen('a', [])).toEqual(['a'])
    expect(pushReopen('b', ['a'])).toEqual(['a', 'b'])
  })

  it('push dibatasi 10 entri, yang tertua dibuang', () => {
    let stack: string[] = []
    for (let i = 0; i < MAX_REOPEN_STACK + 3; i += 1) stack = pushReopen(`t${i}`, stack)
    expect(stack).toHaveLength(MAX_REOPEN_STACK)
    expect(stack[0]).toBe('t3')
  })

  it('pop mengambil yang terakhir dan menyisakan sisanya', () => {
    expect(popReopen(['a', 'b'])).toEqual({ id: 'b', rest: ['a'] })
  })

  it('pop stack kosong = null', () => {
    expect(popReopen([])).toBeNull()
  })
})
