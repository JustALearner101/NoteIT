import type { Notebook, Page, Section } from '@shared/types/domain'

export const INITIAL_SEED_DBML = `Table organizations [color: violet] {
  id uuid [pk]
  slug varchar(64) [unique, not null]
  name varchar(140) [not null]
  tier varchar(32) [not null]
  created_at timestamp [not null]
}

Table users [color: cobalt] {
  id uuid [pk]
  org_id uuid [not null, ref: > organizations.id]
  email varchar(255) [unique, not null]
  full_name varchar(120) [not null]
  role varchar(32) [not null]
  created_at timestamp [not null]
}

Table orders [color: amber] {
  id uuid [pk]
  user_id uuid [not null, ref: > users.id]
  org_id uuid [not null, ref: > organizations.id]
  order_code varchar(32) [unique, not null]
  status varchar(24) [not null]
  total_cents int [not null]
  created_at timestamp [not null]
}

Table inventory_items [color: teal] {
  id uuid [pk]
  sku varchar(64) [unique, not null]
  warehouse_zone varchar(32) [not null]
  available_qty int [not null]
  reserved_qty int [not null]
}

Table order_lines [color: red] {
  id uuid [pk]
  order_id uuid [not null, ref: > orders.id]
  inventory_id uuid [not null, ref: > inventory_items.id]
  quantity int [not null]
  unit_price_cents int [not null]
}`

export const INITIAL_SEED_MERMAID = `sequenceDiagram
    autonumber
    participant Client as Desktop / API Client
    participant Gateway as Order Service
    participant Inv as Inventory Lock Engine
    participant DB as SQLite / Postgres WAL

    Client->>Gateway: POST /v2/orders (sku, qty)
    Gateway->>Inv: AcquireLock(sku, qty, ttl=90s)
    Inv->>DB: BEGIN IMMEDIATE TRANSACTION
    DB-->>Inv: Lock Token #LK-904
    Gateway->>DB: INSERT INTO orders & order_lines
    DB-->>Gateway: Commit Confirmed (1.8ms)
    Gateway-->>Client: 201 Created (Order #ORD-2026)`

export function getSeedData(): {
  notebooks: Notebook[]
  sections: Section[]
  pages: Page[]
} {
  const now = Date.now()

  const notebooks: Notebook[] = [
    {
      id: 'nb-eng-core',
      name: 'Engineering Workbench',
      icon: '📐',
      color: 'cobalt',
      sortOrder: 1,
      createdAt: now - 86400000 * 5,
      updatedAt: now
    },
    {
      id: 'nb-product-lab',
      name: 'Product & Research Lab',
      icon: '🧪',
      color: 'amber',
      sortOrder: 2,
      createdAt: now - 86400000 * 3,
      updatedAt: now
    }
  ]

  const sections: Section[] = [
    {
      id: 'sec-arch',
      notebookId: 'nb-eng-core',
      name: 'Core Architecture',
      code: 'SEC-01',
      color: 'cobalt',
      sortOrder: 1,
      createdAt: now - 86400000 * 5,
      updatedAt: now
    },
    {
      id: 'sec-roadmap',
      notebookId: 'nb-eng-core',
      name: 'Delivery & Gantt',
      code: 'SEC-02',
      color: 'amber',
      sortOrder: 2,
      createdAt: now - 86400000 * 4,
      updatedAt: now
    },
    {
      id: 'sec-canvas',
      notebookId: 'nb-eng-core',
      name: 'Spatial Blueprints',
      code: 'SEC-03',
      color: 'teal',
      sortOrder: 3,
      createdAt: now - 86400000 * 3,
      updatedAt: now
    },
    {
      id: 'sec-notes',
      notebookId: 'nb-product-lab',
      name: 'RFC & Design Specs',
      code: 'SEC-04',
      color: 'violet',
      sortOrder: 1,
      createdAt: now - 86400000 * 2,
      updatedAt: now
    }
  ]

  const pages: Page[] = [
    {
      id: 'pg-101',
      code: 'PG-101',
      sectionId: 'sec-arch',
      parentPageId: null,
      title: 'Sistem Skema & Reservasi Order',
      icon: '🗄️',
      mode: 'block',
      tags: ['dbml', 'core-v2', 'architecture'],
      isFavorite: true,
      isPinned: true,
      sortOrder: 1,
      versionCount: 3,
      createdAt: now - 86400000 * 4,
      updatedAt: now - 60000 * 12,
      blocks: [
        {
          id: 'blk-1',
          type: 'callout',
          calloutColor: 'cobalt',
          calloutTitle: 'SPESIFIKASI CETAK BIRU · MODUL TRANSAKSI V2',
          content:
            'Dokumen ini mendefinisikan skema relasional utama menggunakan DBML interaktif dan alur penguncian inventori. Jadwal rilis dikelola di [[Q4 Master Engineering Roadmap]] dan peta topologi node tersedia di [[Kanvas Arsitektur Sistem]].'
        },
        {
          id: 'blk-2',
          type: 'h2',
          content: '1. Skema Relasional Database (Interactive DBML Studio)'
        },
        {
          id: 'blk-3',
          type: 'paragraph',
          content:
            'Arahkan kursor (hover) pada tabel atau kolom Foreign Key di bawah untuk menyorot jalur relasi secara langsung. Geser posisi tabel di kanvas ERD atau ekspor langsung menjadi SQL DDL.'
        },
        {
          id: 'blk-4',
          type: 'dbml',
          wide: true,
          dbmlViewMode: 'split',
          content: INITIAL_SEED_DBML,
          dbmlLayout: {
            organizations: { x: 20, y: 20, color: 'violet' },
            users: { x: 340, y: 20, color: 'cobalt' },
            orders: { x: 340, y: 240, color: 'amber' },
            inventory_items: { x: 20, y: 250, color: 'teal' },
            order_lines: { x: 670, y: 140, color: 'red' }
          }
        },
        {
          id: 'blk-5',
          type: 'h2',
          content: '2. Diagram Sekuens Penguncian Inventori (Mermaid Offline)'
        },
        {
          id: 'blk-6',
          type: 'mermaid',
          wide: true,
          mermaidViewMode: 'split',
          content: INITIAL_SEED_MERMAID
        },
        {
          id: 'blk-7',
          type: 'h3',
          content: 'Daftar Periksa Kesiapan Produksi'
        },
        {
          id: 'blk-8',
          type: 'checklist',
          checked: true,
          content: 'Aktifkan PRAGMA journal_mode = WAL dan indeks pencarian FTS5'
        },
        {
          id: 'blk-9',
          type: 'checklist',
          checked: true,
          content: 'Validasi foreign key constraint antara order_lines dan inventory_items'
        },
        {
          id: 'blk-10',
          type: 'checklist',
          checked: false,
          content: 'Uji beban 10.000 transaksi konkuren sebelum milestone rilis di [[Q4 Master Engineering Roadmap]]'
        }
      ],
      canvasData: {
        nodes: [
          {
            id: 'cn-1',
            type: 'workCard',
            position: { x: 80, y: 80 },
            data: {
              title: 'Order Gateway Service',
              content: 'Menerima payload reservasi dan memvalidasi kuota organisasi.',
              color: 'cobalt',
              cardType: 'note',
              code: 'SVC-ORDER-01'
            }
          },
          {
            id: 'cn-2',
            type: 'workCard',
            position: { x: 460, y: 80 },
            data: {
              title: 'SQLite WAL Storage Engine',
              content: 'Single-writer, multi-reader dengan latensi kueri lokal < 2ms.',
              color: 'amber',
              cardType: 'metric',
              metricValue: '1.42 ms',
              metricDelta: 'P99 Write Latency'
            }
          }
        ],
        edges: [
          {
            id: 'ce-1',
            source: 'cn-1',
            target: 'cn-2',
            label: 'IPC Sync Write',
            animated: true,
            color: 'cobalt'
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      id: 'pg-102',
      code: 'PG-102',
      sectionId: 'sec-roadmap',
      parentPageId: null,
      title: 'Q4 Master Engineering Roadmap',
      icon: '📊',
      mode: 'block',
      tags: ['roadmap', 'gantt', 'core-v2'],
      isFavorite: true,
      isPinned: false,
      sortOrder: 1,
      versionCount: 2,
      createdAt: now - 86400000 * 3,
      updatedAt: now - 60000 * 35,
      blocks: [
        {
          id: 'blk-r1',
          type: 'paragraph',
          content:
            'Jadwal terpadu pembangunan platform NoteIT v2.0 dan implementasi [[Sistem Skema & Reservasi Order]]. Gunakan tab di bawah untuk beralih antara tampilan Gantt Timeline, Kanban Board, Tabel Terstruktur, dan Grafik Analitik.'
        },
        {
          id: 'blk-r2',
          type: 'database',
          wide: true,
          content: '',
          databaseTitle: 'JADWAL EKSEKUSI ENGINEERING · Q4',
          databaseActiveView: 'gantt',
          databaseChartType: 'bar',
          databaseItems: [
            {
              id: 'tsk-1',
              code: 'TSK-01',
              title: 'Arsitektur SQLite WAL & FTS5 Engine',
              category: 'Core DB',
              color: 'cobalt',
              status: 'done',
              startDate: '2026-10-18',
              endDate: '2026-10-23',
              progress: 100,
              isMilestone: false,
              dependsOn: [],
              assignee: 'Backend Lead',
              estimateHours: 24
            },
            {
              id: 'tsk-2',
              code: 'TSK-02',
              title: 'Desktop Shell & Index Rail Navigation',
              category: 'Workbench UI',
              color: 'teal',
              status: 'done',
              startDate: '2026-10-21',
              endDate: '2026-10-26',
              progress: 100,
              isMilestone: false,
              dependsOn: ['tsk-1'],
              assignee: 'Design Systems',
              estimateHours: 28
            },
            {
              id: 'tsk-3',
              code: 'TSK-03',
              title: 'Interactive DBML Studio & SQL DDL Compiler',
              category: 'Diagramming',
              color: 'amber',
              status: 'in_progress',
              startDate: '2026-10-25',
              endDate: '2026-10-31',
              progress: 75,
              isMilestone: false,
              dependsOn: ['tsk-2'],
              assignee: 'Architecture',
              estimateHours: 36
            },
            {
              id: 'tsk-4',
              code: 'TSK-04',
              title: 'Spatial Freeform Canvas & Node Connectors',
              category: 'Canvas Engine',
              color: 'violet',
              status: 'in_progress',
              startDate: '2026-10-27',
              endDate: '2026-11-03',
              progress: 60,
              isMilestone: false,
              dependsOn: ['tsk-2'],
              assignee: 'Frontend Core',
              estimateHours: 32
            },
            {
              id: 'tsk-5',
              code: 'TSK-05',
              title: 'Gantt Chart Dependency & Conflict Detector',
              category: 'Charting',
              color: 'cobalt',
              status: 'review',
              startDate: '2026-10-30',
              endDate: '2026-11-06',
              progress: 85,
              isMilestone: false,
              dependsOn: ['tsk-3'],
              assignee: 'Data Viz',
              estimateHours: 20
            },
            {
              id: 'tsk-6',
              code: 'M1-REL',
              title: 'Milestone Rilis Internal NoteIT v2.0',
              category: 'Release',
              color: 'amber',
              status: 'backlog',
              startDate: '2026-11-07',
              endDate: '2026-11-08',
              progress: 0,
              isMilestone: true,
              dependsOn: ['tsk-4', 'tsk-5'],
              assignee: 'All Leads',
              estimateHours: 8
            }
          ]
        }
      ],
      canvasData: {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      id: 'pg-103',
      code: 'PG-103',
      sectionId: 'sec-canvas',
      parentPageId: null,
      title: 'Kanvas Arsitektur Sistem',
      icon: '⊞',
      mode: 'canvas',
      tags: ['canvas', 'architecture', 'blueprint'],
      isFavorite: true,
      isPinned: false,
      sortOrder: 1,
      versionCount: 1,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 60000 * 50,
      blocks: [
        {
          id: 'blk-c1',
          type: 'paragraph',
          content:
            'Halaman ini menggunakan mode Spatial Freeform Canvas. Lihat juga spesifikasi detail di [[Sistem Skema & Reservasi Order]].'
        }
      ],
      canvasData: {
        nodes: [
          {
            id: 'node-arch-1',
            type: 'workCard',
            position: { x: 60, y: 70 },
            data: {
              title: 'Electron Renderer (React 19)',
              content:
                'Dual-Mode Workbench: Block Document (Notion style) + Spatial Canvas (OneNote style) dengan transisi Caliper Switch.',
              color: 'cobalt',
              cardType: 'note',
              code: 'LAYER-UI'
            }
          },
          {
            id: 'node-arch-2',
            type: 'workCard',
            position: { x: 460, y: 60 },
            data: {
              title: 'ContextBridge Typed IPC',
              content:
                'Jembatan komunikasi terisolasi (window.noteitAPI) dengan validasi payload penuh antara UI dan Node.js.',
              color: 'teal',
              cardType: 'note',
              code: 'LAYER-IPC'
            }
          },
          {
            id: 'node-arch-3',
            type: 'workCard',
            position: { x: 850, y: 70 },
            data: {
              title: 'SQLite WAL + FTS5 Index',
              content:
                'Penyimpanan tunggal offline-first dengan indeks pencarian penuh atas teks blok, kartu kanvas, dan skema DBML.',
              color: 'amber',
              cardType: 'metric',
              code: 'STORAGE-CORE',
              metricValue: '< 1.5 ms',
              metricDelta: 'FTS5 Full-Text Query'
            }
          },
          {
            id: 'node-arch-4',
            type: 'workCard',
            position: { x: 260, y: 310 },
            data: {
              title: 'DBML & Mermaid Offline Engine',
              content:
                'Parser DBML real-time ke skematik ERD interaktif + generator DDL SQL tanpa ketergantungan server luar.',
              color: 'violet',
              cardType: 'dbml',
              code: 'MOD-DIAGRAM'
            }
          },
          {
            id: 'node-arch-5',
            type: 'workCard',
            position: { x: 670, y: 310 },
            data: {
              title: 'Catatan Arsitek',
              content:
                'Seluruh posisi node di kanvas ini disimpan langsung ke kolom canvas_json di SQLite setiap kali digeser.',
              color: 'amber',
              cardType: 'sticky',
              code: 'MEMO-01'
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-arch-1',
            target: 'node-arch-2',
            label: 'ipcRenderer.invoke',
            animated: true,
            color: 'cobalt'
          },
          {
            id: 'edge-2',
            source: 'node-arch-2',
            target: 'node-arch-3',
            label: 'Synchronous SQLite WAL',
            animated: true,
            color: 'teal'
          },
          {
            id: 'edge-3',
            source: 'node-arch-1',
            target: 'node-arch-4',
            label: 'AST Parse & Layout',
            animated: false,
            color: 'violet'
          },
          {
            id: 'edge-4',
            source: 'node-arch-4',
            target: 'node-arch-3',
            label: 'Persist Node Coords',
            animated: false,
            color: 'amber'
          }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      id: 'pg-104',
      code: 'PG-104',
      sectionId: 'sec-arch',
      parentPageId: 'pg-101',
      title: 'Sub-Spesifikasi: Protokol Audit & Snapshot',
      icon: '🛡️',
      mode: 'block',
      tags: ['audit', 'sqlite', 'core-v2'],
      isFavorite: false,
      isPinned: false,
      sortOrder: 2,
      versionCount: 1,
      createdAt: now - 86400000,
      updatedAt: now - 60000 * 90,
      blocks: [
        {
          id: 'blk-s1',
          type: 'h2',
          content: 'Protokol Snapshot Versi Lokal'
        },
        {
          id: 'blk-s2',
          type: 'paragraph',
          content:
            'Sub-halaman ini berada di bawah [[Sistem Skema & Reservasi Order]]. Setiap kali pengguna menekan tombol Simpan Snapshot di Spec Header, sistem membekukan JSON blok dan kanvas ke tabel page_versions di SQLite.'
        },
        {
          id: 'blk-s3',
          type: 'code',
          language: 'sql',
          content: `CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  page_id UNINDEXED,
  title,
  plain_text,
  tags
);`
        }
      ],
      canvasData: {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    }
  ]

  return { notebooks, sections, pages }
}
