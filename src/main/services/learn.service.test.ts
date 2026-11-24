import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDatabase, seedInitialWorkspace } from '../db/client'

const mockRunTextCompletion = vi.fn()
const mockRunStructuredObject = vi.fn()

vi.mock('./ai.service', () => ({
  runTextCompletion: (...args: unknown[]) => mockRunTextCompletion(...args),
  runStructuredObject: (...args: unknown[]) => mockRunStructuredObject(...args)
}))

import {
  askLearnSideQuestion,
  createLearnSession,
  crystallizeLearnSessionToPage,
  deleteKgProposition,
  extractKnowledgeGraph,
  getKnowledgeGraph,
  getLearnSessionDetail,
  listLearnSessions,
  submitLearnResponse,
  updateKgNodePosition
} from './learn.service'

describe('learn.service (Strict Live-Only Learning Workbench & Knowledge Graph)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-learn-test-'))
    const db = initDatabase(tmpDir)
    seedInitialWorkspace(db)
    mockRunTextCompletion.mockReset()
    mockRunStructuredObject.mockReset()
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rejects session creation with a clear error when no live AI provider is configured (no fake fallback)', async () => {
    mockRunTextCompletion.mockResolvedValue({
      ok: false,
      text: 'No AI provider is configured. Open Settings → AI Providers.',
      providerLabel: 'Unconfigured',
      usedLiveProvider: false
    })

    await expect(
      createLearnSession({
        title: 'SQLite WAL',
        goal: 'Understand WAL'
      })
    ).rejects.toThrow(/No AI provider is configured/i)

    // Failed session creation must not leave orphan empty sessions in SQLite
    expect(listLearnSessions()).toHaveLength(0)
  })

  it('runs full live probe -> plan -> teach -> side-question -> crystallize flow', async () => {
    mockRunTextCompletion
      .mockResolvedValueOnce({
        ok: true,
        text: 'Diagnostic question: What happens when a writer commits while a reader is active?',
        providerLabel: 'Google Gemini (gemini-2.5-flash)',
        usedLiveProvider: true
      })
      .mockResolvedValueOnce({
        ok: true,
        text: 'Here is your dependency plan:\n```mermaid\nflowchart TD\n  N1["WAL Frames"] --> N2["Snapshot Isolation"]\n```',
        providerLabel: 'Google Gemini (gemini-2.5-flash)',
        usedLiveProvider: true
      })
      .mockResolvedValueOnce({
        ok: true,
        text: 'Great! Let us explore N1: WAL appends frames sequentially instead of overwriting pages.',
        providerLabel: 'Google Gemini (gemini-2.5-flash)',
        usedLiveProvider: true
      })
      .mockResolvedValueOnce({
        ok: true,
        text: 'On crash before checkpoint, SQLite replays valid committed frames from the -wal file on next open.',
        providerLabel: 'Google Gemini (gemini-2.5-flash)',
        usedLiveProvider: true
      })

    const created = await createLearnSession({
      title: 'SQLite WAL Internals',
      goal: 'Understand how SQLite WAL enables concurrent readers with a single writer'
    })
    expect(created.session.phase).toBe('probe')
    expect(created.turns).toHaveLength(1)
    expect(listLearnSessions()).toHaveLength(1)

    const afterProbe = await submitLearnResponse({
      sessionId: created.session.id,
      answer: 'I know WAL writes to a separate file before checkpointing.',
      thinkingText: 'Not sure how readers avoid seeing uncommitted frames.',
      confidence: 3
    })
    expect(afterProbe.session.phase).toBe('plan')
    expect(afterProbe.session.planMermaid).toContain('flowchart TD')

    const afterPlan = await submitLearnResponse({
      sessionId: created.session.id,
      answer: 'Looks good, let us start with N1.'
    })
    expect(afterPlan.session.phase).toBe('teach')

    const side = await askLearnSideQuestion({
      sessionId: created.session.id,
      selectedQuote: 'WAL writes to a separate file',
      question: 'What happens if the app crashes before checkpoint?'
    })
    expect(side.messages).toHaveLength(2)
    expect(getLearnSessionDetail(created.session.id)?.session.phase).toBe('teach')

    const page = crystallizeLearnSessionToPage({ sessionId: created.session.id })
    expect(page.title).toContain('SQLite WAL Internals')
    expect(page.blocks.some((b) => b.type === 'mermaid')).toBe(true)
  })

  it('extracts and deterministically deduplicates Propositional Knowledge Graph nodes & chains via live structured output', async () => {
    mockRunTextCompletion.mockResolvedValueOnce({
      ok: true,
      text: 'A network partition splits distributed nodes into isolated groups.',
      providerLabel: 'Google Gemini',
      usedLiveProvider: true
    })

    const created = await createLearnSession({
      title: 'CAP Theorem',
      goal: 'Understand consistency vs availability under network partitions'
    })

    const kgResult = {
      ok: true,
      object: {
        propositions: [
          { statement: 'Network partitions isolate distributed replicas.', domainTag: 'CAP' },
          { statement: 'During a partition, systems must trade off consistency and availability.', domainTag: 'CAP' }
        ],
        chains: [
          {
            premises: ['Network partitions isolate distributed replicas.'],
            conclusion: 'During a partition, systems must trade off consistency and availability.',
            relationLabel: 'entails'
          }
        ]
      },
      providerLabel: 'Google Gemini'
    }
    mockRunStructuredObject.mockResolvedValue(kgResult)

    const first = await extractKnowledgeGraph({ sessionId: created.session.id })
    expect(first.addedPropositions).toBe(2)
    expect(first.addedChains).toBe(1)

    const second = await extractKnowledgeGraph({ sessionId: created.session.id })
    expect(second.addedPropositions).toBe(0)
    expect(second.snapshot.propositions).toHaveLength(2)

    const firstNode = second.snapshot.propositions[0]
    updateKgNodePosition(firstNode.id, 420, 260)
    expect(getKnowledgeGraph().propositions.find((p) => p.id === firstNode.id)?.posX).toBe(420)

    deleteKgProposition(firstNode.id)
    expect(getKnowledgeGraph().propositions.some((p) => p.id === firstNode.id)).toBe(false)
  })
})
