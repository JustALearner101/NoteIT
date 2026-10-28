import { describe, expect, it } from 'vitest'
import type { CanvasState, DocumentBlock, Page } from '@shared/types/domain'
import { extractPlainTextFromPage, extractWikiLinkTitles } from './client'

function block(overrides: Partial<DocumentBlock>): DocumentBlock {
  return { id: 'block', type: 'paragraph', content: '', ...overrides }
}

const canvasData: CanvasState = {
  nodes: [
    {
      id: 'node-1',
      type: 'workCard',
      position: { x: 0, y: 0 },
      data: {
        title: 'Kartu Arsitektur',
        content: 'Catatan kanvas',
        color: 'teal',
        cardType: 'note',
        code: 'CARD-09'
      }
    }
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
}

describe('extractPlainTextFromPage', () => {
  it('menggabungkan judul, blocks, canvas nodes, dan tags', () => {
    const page: Pick<Page, 'title' | 'blocks' | 'canvasData' | 'tags'> = {
      title: 'Arsitektur Sistem',
      blocks: [
        block({ id: 'b1', content: 'Ringkasan arsitektur' }),
        block({
          id: 'b2',
          type: 'callout',
          content: 'Perhatian',
          calloutTitle: 'Catatan Rilis'
        }),
        block({
          id: 'b3',
          type: 'database',
          databaseTitle: 'Papan Tugas',
          databaseItems: [
            {
              id: 't1',
              code: 'TSK-01',
              title: 'Migrasi DB',
              category: 'Infra',
              color: 'cobalt',
              status: 'done',
              startDate: '2026-01-01',
              endDate: '2026-01-02',
              progress: 100,
              isMilestone: false,
              dependsOn: [],
              assignee: 'Rani',
              estimateHours: 4
            }
          ]
        })
      ],
      canvasData,
      tags: ['arsitektur', 'durability']
    }

    expect(extractPlainTextFromPage(page).split('\n')).toEqual([
      'Arsitektur Sistem',
      'Ringkasan arsitektur',
      'Perhatian',
      'Catatan Rilis',
      'Papan Tugas',
      'TSK-01 Migrasi DB Infra Rani',
      'Kartu Arsitektur',
      'Catatan kanvas',
      'CARD-09',
      'arsitektur durability'
    ])
  })

  it('hanya mengembalikan judul bila tidak ada blocks, canvas, atau tags', () => {
    const page: Pick<Page, 'title' | 'blocks' | 'canvasData' | 'tags'> = {
      title: 'Halaman Kosong',
      blocks: [],
      canvasData: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      tags: []
    }

    expect(extractPlainTextFromPage(page)).toBe('Halaman Kosong')
  })
})

describe('extractWikiLinkTitles', () => {
  it('mendeteksi [[Wiki Link]] di blocks dan canvas nodes', () => {
    const refs = extractWikiLinkTitles({
      blocks: [
        block({ id: 'b1', content: 'Lihat [[Arsitektur Sistem]] untuk detail.' }),
        block({ id: 'b2', content: 'Tidak ada tautan di sini.' })
      ],
      canvasData
    })

    expect(refs.map((r) => r.targetTitle)).toEqual(['Arsitektur Sistem'])
    expect(refs[0].snippet).toBe('Lihat [[Arsitektur Sistem]] untuk detail.')
  })

  it('memotong snippet pada 140 karakter dan menambahkan elipsis', () => {
    const longContent = 'x'.repeat(150) + ' [[Target Panjang]]'
    const refs = extractWikiLinkTitles({
      blocks: [block({ id: 'b1', content: longContent })],
      canvasData: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
    })

    expect(refs).toHaveLength(1)
    expect(refs[0].targetTitle).toBe('Target Panjang')
    expect(refs[0].snippet).toBe(longContent.slice(0, 140) + '...')
    expect(refs[0].snippet).toHaveLength(143)
  })

  it('mengembalikan array kosong bila tidak ada tautan', () => {
    expect(
      extractWikiLinkTitles({
        blocks: [block({ id: 'b1', content: 'teks biasa' })],
        canvasData: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
      })
    ).toEqual([])
  })
})
