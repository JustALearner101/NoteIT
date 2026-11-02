import { describe, expect, it } from 'vitest'
import {
  compileDBMLBlocksToSQL,
  compileDiagramBlocks,
  generateActiveTaskMarkdown,
  generateMissionExecutionCommand
} from './spec-compiler.service'
import type { DocumentBlock, Page } from '@shared/types/domain'

describe('spec-compiler.service', () => {
  const dummyPage: Page = {
    id: 'page-arc-04',
    code: 'ARC-04',
    sectionId: 'sec-01',
    parentPageId: null,
    title: 'Sistem Autentikasi OAuth2',
    icon: '🔐',
    mode: 'block',
    blocks: [
      {
        id: 'blk-1',
        type: 'paragraph',
        content: 'Implementasikan autentikasi OAuth2 dengan token JWT dan refresh token rotation.'
      },
      {
        id: 'blk-2',
        type: 'callout',
        calloutTitle: 'ATURAN KEAMANAN',
        calloutColor: 'amber',
        content: 'Token secret wajib dibaca dari environment variable, jangan hardcoded.'
      },
      {
        id: 'blk-3',
        type: 'checklist',
        content: 'Buat endpoint POST /api/auth/token',
        checked: true
      },
      {
        id: 'blk-4',
        type: 'checklist',
        content: 'Buat unit test refresh token rotation',
        checked: false
      },
      {
        id: 'blk-5',
        type: 'database',
        content: '',
        databaseTitle: 'Engineering Tasks',
        databaseItems: [
          {
            id: 'tsk-01',
            code: 'TSK-01',
            title: 'Setup skema database token',
            category: 'Backend',
            color: 'cobalt',
            status: 'done',
            startDate: '2026-11-01',
            endDate: '2026-11-02',
            progress: 100,
            isMilestone: false,
            dependsOn: [],
            assignee: 'Budi',
            estimateHours: 4
          }
        ]
      }
    ],
    canvasData: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    tags: ['auth', 'security'],
    isFavorite: false,
    isPinned: false,
    sortOrder: 1,
    versionCount: 1,
    createdAt: 1730000000000,
    updatedAt: 1730000000000
  }

  describe('generateActiveTaskMarkdown', () => {
    it('compiles page title, PRD context, tasks, and checklists into markdown', () => {
      const md = generateActiveTaskMarkdown(dummyPage, 'D:\\Project\\NoteIT')

      expect(md).toContain('# KONTRAK TUGAS REKAYASA: ARC-04 · Sistem Autentikasi OAuth2')
      expect(md).toContain('Implementasikan autentikasi OAuth2')
      expect(md).toContain('> [!NOTE] ATURAN KEAMANAN')
      expect(md).toContain('[x] Buat endpoint POST /api/auth/token')
      expect(md).toContain('[ ] Buat unit test refresh token rotation')
      expect(md).toContain('TSK-01')
      expect(md).toContain('Setup skema database token')
      expect(md).toContain('`DONE`')
    })
  })

  describe('compileDBMLBlocksToSQL', () => {
    it('converts DBML blocks into clean SQLite DDL', () => {
      const blocks: DocumentBlock[] = [
        {
          id: 'b-dbml',
          type: 'dbml',
          content: `
Table auth_sessions {
  id uuid [pk]
  user_id uuid [not null]
  refresh_token varchar [unique, not null]
  expires_at timestamp
}
          `
        }
      ]

      const sql = compileDBMLBlocksToSQL(blocks)
      expect(sql).toContain('CREATE TABLE "auth_sessions"')
      expect(sql).toContain('"id" UUID PRIMARY KEY')
      expect(sql).toContain('"refresh_token" VARCHAR UNIQUE NOT NULL')
    })

    it('handles pages without DBML blocks gracefully', () => {
      const sql = compileDBMLBlocksToSQL([])
      expect(sql).toContain('Tidak ada blok skema DBML')
    })
  })

  describe('compileDiagramBlocks', () => {
    it('extracts Mermaid and Graphviz blocks', () => {
      const blocks: DocumentBlock[] = [
        {
          id: 'b-mmd',
          type: 'mermaid',
          content: 'flowchart LR\n  Client --> Server'
        }
      ]

      const mmd = compileDiagramBlocks(blocks)
      expect(mmd).toContain('flowchart LR')
      expect(mmd).toContain('Client --> Server')
    })
  })

  describe('generateMissionExecutionCommand', () => {
    it('maps Claude Code approval flags correctly', () => {
      const plan = generateMissionExecutionCommand('claude', 'plan-only')
      expect(plan.command).toBe('claude')
      expect(plan.args).toEqual(['--permission-mode', 'plan'])

      const auto = generateMissionExecutionCommand('claude', 'auto-edit')
      expect(auto.args).toEqual(['--dangerously-skip-permissions'])
    })

    it('maps Codex approval flags correctly', () => {
      const auto = generateMissionExecutionCommand('codex', 'auto-edit')
      expect(auto.command).toBe('codex')
      expect(auto.args).toEqual(['--full-auto'])
    })

    it('maps Aider approval flags correctly', () => {
      const auto = generateMissionExecutionCommand('aider', 'auto-edit')
      expect(auto.command).toBe('aider')
      expect(auto.args).toEqual(['--yes-always'])
    })

    it('includes custom directive in prompt text', () => {
      const res = generateMissionExecutionCommand('claude', 'ask-edit', 'Gunakan TDD strictly')
      expect(res.promptText).toContain('Arahan tambahan: Gunakan TDD strictly')
    })
  })
})
