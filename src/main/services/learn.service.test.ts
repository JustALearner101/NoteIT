import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db/client'
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

describe('learn.service (Native Learning Workbench & Knowledge Graph)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-learn-test-'))
    initDatabase(tmpDir)
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('runs full probe -> plan -> teach -> side-question -> crystallize flow', async () => {
    const created = await createLearnSession({
      title: 'SQLite WAL Internals',
      goal: 'Understand how SQLite WAL enables concurrent readers with a single writer'
    })
    expect(created.session.phase).toBe('probe')
    expect(created.turns).toHaveLength(1)
    expect(listLearnSessions()).toHaveLength(1)

    // Probe -> Plan (generates Mermaid DAG)
    const afterProbe = await submitLearnResponse({
      sessionId: created.session.id,
      answer: 'I know WAL writes to a separate file before checkpointing.',
      thinkingText: 'Not sure how readers avoid seeing uncommitted frames.',
      confidence: 3
    })
    expect(afterProbe.session.phase).toBe('plan')
    expect(afterProbe.session.planMermaid).toContain('flowchart TD')

    // Plan -> Teach
    const afterPlan = await submitLearnResponse({
      sessionId: created.session.id,
      answer: 'Looks good, let us start with N1.'
    })
    expect(afterPlan.session.phase).toBe('teach')

    // Side question without changing main phase
    const side = await askLearnSideQuestion({
      sessionId: created.session.id,
      selectedQuote: 'WAL writes to a separate file',
      question: 'What happens if the app crashes before checkpoint?'
    })
    expect(side.messages).toHaveLength(2)
    expect(getLearnSessionDetail(created.session.id)?.session.phase).toBe('teach')

    // Crystallize to NoteIT Page
    const page = crystallizeLearnSessionToPage({ sessionId: created.session.id })
    expect(page.title).toContain('SQLite WAL Internals')
    expect(page.blocks.some((b) => b.type === 'mermaid')).toBe(true)
  })

  it('extracts and deterministically deduplicates Propositional Knowledge Graph nodes & chains', async () => {
    const created = await createLearnSession({
      title: 'CAP Theorem',
      goal: 'Understand consistency vs availability under network partitions',
      sourceExcerpt:
        'A network partition splits distributed nodes into isolated groups. When a partition occurs, a system must choose between consistency and availability. Choosing consistency rejects writes on the minority side to preserve linearizability.'
    })

    const first = await extractKnowledgeGraph({ sessionId: created.session.id })
    expect(first.addedPropositions).toBeGreaterThan(0)
    const countAfterFirst = first.snapshot.propositions.length

    // Running extraction a second time on the exact same content must deduplicate!
    const second = await extractKnowledgeGraph({ sessionId: created.session.id })
    expect(second.addedPropositions).toBe(0)
    expect(second.snapshot.propositions.length).toBe(countAfterFirst)

    // Update position & delete node
    const firstNode = second.snapshot.propositions[0]
    updateKgNodePosition(firstNode.id, 420, 260)
    const updated = getKnowledgeGraph().propositions.find((p) => p.id === firstNode.id)
    expect(updated?.posX).toBe(420)
    expect(updated?.posY).toBe(260)

    deleteKgProposition(firstNode.id)
    expect(getKnowledgeGraph().propositions.some((p) => p.id === firstNode.id)).toBe(false)
  })
})
