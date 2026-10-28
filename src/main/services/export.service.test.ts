import { describe, expect, it } from 'vitest'
import type { DocumentBlock, Page, ProjectTaskItem, WorkspaceSnapshot } from '@shared/types/domain'
import {
  pageToMarkdown,
  slugifyTitle,
  workspaceToMarkdownFiles
} from './export.service'

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'pg-test',
    code: 'PG-999',
    sectionId: 'sec-test',
    parentPageId: null,
    title: 'Halaman Uji',
    icon: '📄',
    mode: 'block',
    blocks: [],
    canvasData: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    tags: ['arsitektur', 'uji'],
    isFavorite: false,
    isPinned: false,
    sortOrder: 0,
    versionCount: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides
  }
}

function makeBlock(overrides: Partial<DocumentBlock>): DocumentBlock {
  return { id: 'blk-1', type: 'paragraph', content: '', ...overrides }
}

function makeItem(overrides: Partial<ProjectTaskItem>): ProjectTaskItem {
  return {
    id: 'item-1',
    code: 'TSK-01',
    title: 'Task Uji',
    category: 'engineering',
    color: 'cobalt',
    status: 'in_progress',
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    progress: 40,
    isMilestone: false,
    dependsOn: [],
    assignee: 'Rani',
    estimateHours: 8,
    ...overrides
  }
}

describe('export.service — pageToMarkdown', () => {
  it('menulis frontmatter YAML dengan title, code, mode, tags, dan updatedAt', () => {
    const markdown = pageToMarkdown(makePage())

    expect(markdown.startsWith('---\n')).toBe(true)
    expect(markdown).toContain('title: "Halaman Uji"')
    expect(markdown).toContain('code: "PG-999"')
    expect(markdown).toContain('mode: block')
    expect(markdown).toContain('tags: ["arsitektur", "uji"]')
    expect(markdown).toContain('updatedAt: 2023-11-14T22:13:20.000Z')
  })

  it('merender heading h1/h2/h3 dan paragraph', () => {
    const markdown = pageToMarkdown(
      makePage({
        blocks: [
          makeBlock({ id: 'b1', type: 'h1', content: 'Judul Besar' }),
          makeBlock({ id: 'b2', type: 'h2', content: 'Sub Judul' }),
          makeBlock({ id: 'b3', type: 'h3', content: 'Sub Sub Judul' }),
          makeBlock({ id: 'b4', type: 'paragraph', content: 'Isi paragraf biasa.' })
        ]
      })
    )

    expect(markdown).toContain('# Judul Besar')
    expect(markdown).toContain('## Sub Judul')
    expect(markdown).toContain('### Sub Sub Judul')
    expect(markdown).toContain('Isi paragraf biasa.')
  })

  it('merender checklist checked dan unchecked', () => {
    const markdown = pageToMarkdown(
      makePage({
        blocks: [
          makeBlock({ id: 'c1', type: 'checklist', content: 'Sudah selesai', checked: true }),
          makeBlock({ id: 'c2', type: 'checklist', content: 'Belum selesai', checked: false })
        ]
      })
    )

    expect(markdown).toContain('- [x] Sudah selesai')
    expect(markdown).toContain('- [ ] Belum selesai')
  })

  it('merender callout sebagai blockquote dengan judul tebal', () => {
    const markdown = pageToMarkdown(
      makePage({
        blocks: [
          makeBlock({
            id: 'cl1',
            type: 'callout',
            content: 'Jangan hapus database.',
            calloutTitle: 'Peringatan'
          })
        ]
      })
    )

    expect(markdown).toContain('> **Peringatan**')
    expect(markdown).toContain('> Jangan hapus database.')
  })

  it('merender code fence dengan language dan default kosong', () => {
    const markdown = pageToMarkdown(
      makePage({
        blocks: [
          makeBlock({ id: 'cd1', type: 'code', content: 'const a = 1', language: 'ts' }),
          makeBlock({ id: 'cd2', type: 'code', content: 'tanpa bahasa' })
        ]
      })
    )

    expect(markdown).toContain('\u0060\u0060\u0060ts\nconst a = 1\n\u0060\u0060\u0060')
    expect(markdown).toContain('\u0060\u0060\u0060\ntanpa bahasa\n\u0060\u0060\u0060')
  })

  it('merender blok dbml dan mermaid sebagai fence bertipe', () => {
    const markdown = pageToMarkdown(
      makePage({
        blocks: [
          makeBlock({ id: 'db1', type: 'dbml', content: 'Table users { id int }' }),
          makeBlock({ id: 'mm1', type: 'mermaid', content: 'graph TD; A-->B;' })
        ]
      })
    )

    expect(markdown).toContain('\u0060\u0060\u0060dbml\nTable users { id int }\n\u0060\u0060\u0060')
    expect(markdown).toContain('\u0060\u0060\u0060mermaid\ngraph TD; A-->B;\n\u0060\u0060\u0060')
  })

  it('merender database block sebagai heading + tabel + catatan milestone/dependency', () => {
    const items = [
      makeItem({ id: 'item-1', code: 'TSK-01', title: 'Rancang skema', isMilestone: true }),
      makeItem({
        id: 'item-2',
        code: 'TSK-02',
        title: 'Implementasi API',
        status: 'backlog',
        progress: 0,
        dependsOn: ['item-1']
      })
    ]

    const markdown = pageToMarkdown(
      makePage({
        blocks: [
          makeBlock({
            id: 'dbb1',
            type: 'database',
            content: '',
            databaseTitle: 'Roadmap Rilis',
            databaseItems: items
          })
        ]
      })
    )

    expect(markdown).toContain('### Roadmap Rilis')
    expect(markdown).toContain('| Code | Title | Status | Start | End | Progress | Assignee |')
    expect(markdown).toContain(
      '| TSK-01 | Rancang skema | in_progress | 2026-01-01 | 2026-01-10 | 40% | Rani |'
    )
    expect(markdown).toContain('| TSK-02 | Implementasi API | backlog | 2026-01-01 | 2026-01-10 | 0% | Rani |')
    expect(markdown).toContain('**Milestone:**')
    expect(markdown).toContain('- TSK-01 Rancang skema (2026-01-10)')
    expect(markdown).toContain('**Dependencies:**')
    expect(markdown).toContain('- TSK-02 depends on TSK-01')
  })

  it('menambahkan section Canvas (node + edge) untuk halaman mode canvas', () => {
    const markdown = pageToMarkdown(
      makePage({
        mode: 'canvas',
        blocks: [makeBlock({ id: 'h', type: 'h1', content: 'Peta Sistem' })],
        canvasData: {
          nodes: [
            {
              id: 'n1',
              type: 'workCard',
              position: { x: 0, y: 0 },
              data: {
                title: 'API Gateway',
                content: 'Pintu masuk semua request',
                color: 'cobalt',
                cardType: 'note',
                code: 'SYS-01'
              }
            },
            {
              id: 'n2',
              type: 'workCard',
              position: { x: 200, y: 0 },
              data: {
                title: 'SQLite',
                content: 'Penyimpanan lokal',
                color: 'teal',
                cardType: 'dbml'
              }
            }
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'menulis ke' }],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      })
    )

    expect(markdown).toContain('## Canvas')
    expect(markdown).toContain('### Nodes')
    expect(markdown).toContain('**API Gateway** (note) — Pintu masuk semua request · code: \u0060SYS-01\u0060')
    expect(markdown).toContain('**SQLite** (dbml) — Penyimpanan lokal')
    expect(markdown).toContain('### Edges')
    expect(markdown).toContain('- API Gateway → SQLite — menulis ke')
  })

  it('tidak menambahkan section Canvas untuk halaman mode block', () => {
    const markdown = pageToMarkdown(makePage({ mode: 'block' }))
    expect(markdown).not.toContain('## Canvas')
  })
})

describe('export.service — workspaceToMarkdownFiles', () => {
  it('membuat satu file per halaman dengan nama <code>-<slug>.md dan frontmatter', () => {
    const snapshot = {
      notebooks: [],
      sections: [],
      pages: [
        makePage({ id: 'p1', code: 'PG-101', title: 'Arsitektur & Data Model' }),
        makePage({ id: 'p2', code: 'PG-102', title: 'Rencana Rilis' })
      ],
      tags: [],
      stats: { sqliteWalActive: true, ftsIndexedPages: 2, dbPath: 'x' }
    } as WorkspaceSnapshot

    const files = workspaceToMarkdownFiles(snapshot)

    expect(files).toHaveLength(2)
    expect(files[0].filename).toBe('PG-101-arsitektur-data-model.md')
    expect(files[1].filename).toBe('PG-102-rencana-rilis.md')
    expect(files[0].content.startsWith('---\n')).toBe(true)
    expect(files[0].content).toContain('code: "PG-101"')
  })

  it('memastikan nama file unik saat judul sama', () => {
    const snapshot = {
      notebooks: [],
      sections: [],
      pages: [
        makePage({ id: 'p1', code: 'PG-201', title: 'Catatan Harian' }),
        makePage({ id: 'p2', code: 'PG-201', title: 'Catatan Harian' }),
        makePage({ id: 'p3', code: 'PG-201', title: 'Catatan Harian' })
      ],
      tags: [],
      stats: { sqliteWalActive: true, ftsIndexedPages: 3, dbPath: 'x' }
    } as WorkspaceSnapshot

    const names = workspaceToMarkdownFiles(snapshot).map((file) => file.filename)

    expect(names).toEqual([
      'PG-201-catatan-harian.md',
      'PG-201-catatan-harian-2.md',
      'PG-201-catatan-harian-3.md'
    ])
  })

  it('fallback ke code saat judul tidak menghasilkan slug', () => {
    const snapshot = {
      notebooks: [],
      sections: [],
      pages: [makePage({ id: 'p1', code: 'PG-301', title: '!!! ???' })],
      tags: [],
      stats: { sqliteWalActive: true, ftsIndexedPages: 1, dbPath: 'x' }
    } as WorkspaceSnapshot

    expect(workspaceToMarkdownFiles(snapshot)[0].filename).toBe('PG-301-pg-301.md')
  })

  it('slugifyTitle memotong maksimal 60 karakter dan membuang tanda hubung di tepi', () => {
    const longTitle = 'A'.repeat(80)
    expect(slugifyTitle(longTitle)).toHaveLength(60)
    expect(slugifyTitle('  --Judul--Aneh!!  ')).toBe('judul-aneh')
  })
})
