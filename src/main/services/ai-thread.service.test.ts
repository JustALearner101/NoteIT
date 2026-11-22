import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db/client'
import {
  createAiThread,
  deleteAiThread,
  getAiThreadWithMessages,
  listAiThreads,
  saveAiMessage,
  updateAiThread
} from './ai-thread.service'

describe('ai-thread.service (SQLite AI Studio Persistence)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-aithread-test-'))
    initDatabase(tmpDir)
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates, updates, saves multimodal + Intelligent UI messages, and deletes threads', () => {
    const thread = createAiThread({
      title: 'Loan Calculator UI',
      uiMode: 'intelligent-ui',
      chatMode: 'Free chat'
    })
    expect(listAiThreads()).toHaveLength(1)

    saveAiMessage({
      threadId: thread.id,
      role: 'user',
      content: 'Build an interactive loan calculator with a slider',
      attachments: [{ id: 'att-1', kind: 'image', name: 'ref.png', mime: 'image/png' }]
    })

    saveAiMessage({
      threadId: thread.id,
      role: 'assistant',
      content: 'Here is an interactive loan calculator.',
      reasoningText: 'We need a Slider bound to $principal and @Payment formula.',
      uiArtifact: {
        kind: 'openui',
        title: 'Loan Calculator',
        openuiSource: 'root = Card([Title("Loan Calculator")])'
      },
      telemetry: {
        inputTokens: 420,
        outputTokens: 180,
        totalTokens: 600,
        latencyMs: 920,
        steps: 1,
        routedUiMode: 'openui'
      }
    })

    updateAiThread(thread.id, { title: 'Interactive Loan Calculator' })

    const loaded = getAiThreadWithMessages(thread.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.thread.title).toBe('Interactive Loan Calculator')
    expect(loaded!.messages).toHaveLength(2)
    expect(loaded!.messages[0].attachments[0].name).toBe('ref.png')
    expect(loaded!.messages[1].reasoningText).toContain('$principal')
    expect(loaded!.messages[1].uiArtifact?.kind).toBe('openui')
    expect(loaded!.messages[1].telemetry.totalTokens).toBe(600)

    deleteAiThread(thread.id)
    expect(listAiThreads()).toHaveLength(0)
  })
})
