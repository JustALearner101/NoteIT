import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db/client'
import { getWorkspaceSnapshot } from './workspace.service'
import { executeAIChatStream } from './ai.service'
import type { AIChatStreamEvent } from '@shared/ipc-channels'

let tempDir: string

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteit-ai-test-'))
  initDatabase(tempDir)
})

afterAll(() => {
  closeDb()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('ai.service (Vercel AI SDK + Local Agentic Fallback)', () => {
  it('streams text-delta, tool-call, and approval-request when approvalMode is ask', async () => {
    const snap = getWorkspaceSnapshot()
    const targetPage = snap.pages[0]
    expect(targetPage).toBeDefined()

    const events: AIChatStreamEvent[] = []
    await executeAIChatStream(
      {
        requestId: 'req-test-1',
        provider: 'gemini',
        modelId: 'gemini-2.5-pro',
        chatMode: 'dbml-architect',
        approvalMode: 'ask',
        activePageId: targetPage.id,
        mentionedPageIds: [targetPage.id],
        messages: [
          {
            role: 'user',
            content: 'Buatkan spesifikasi skema DBML untuk layanan autentikasi'
          }
        ]
      },
      (event) => events.push(event)
    )

    expect(events.some((e) => e.type === 'text-delta')).toBe(true)
    expect(
      events.some((e) => e.type === 'tool-call' && e.toolName === 'propose_spec_blocks')
    ).toBe(true)
    const approvalEvent = events.find((e) => e.type === 'approval-request')
    expect(approvalEvent).toBeDefined()
    expect(approvalEvent?.proposal?.targetPageId).toBe(targetPage.id)
    expect(approvalEvent?.proposal?.blocks[0]?.type).toBe('dbml')
    expect(events.at(-1)?.type).toBe('done')
  })

  it('auto-applies proposed blocks to SQLite when approvalMode is auto-edit', async () => {
    const snapBefore = getWorkspaceSnapshot()
    const targetPage = snapBefore.pages[0]
    const initialBlockCount = targetPage.blocks.length

    const events: AIChatStreamEvent[] = []
    await executeAIChatStream(
      {
        requestId: 'req-test-2',
        provider: 'ollama',
        modelId: 'qwen2.5-coder:14b',
        chatMode: 'spec-coauthor',
        approvalMode: 'auto-edit',
        activePageId: targetPage.id,
        mentionedPageIds: [],
        browserContext: {
          title: 'RFC 6749 OAuth 2.0',
          url: 'https://datatracker.ietf.org/doc/html/rfc6749',
          excerpt: 'The OAuth 2.0 authorization framework enables a third-party application...'
        },
        messages: [
          {
            role: 'user',
            content: 'Buat diagram sequence mermaid berdasarkan halaman browser ini'
          }
        ]
      },
      (event) => events.push(event)
    )

    expect(
      events.some((e) => e.type === 'tool-call' && e.toolName === 'read_active_browser_tab')
    ).toBe(true)
    expect(events.some((e) => e.type === 'auto-applied')).toBe(true)

    const snapAfter = getWorkspaceSnapshot()
    const updatedPage = snapAfter.pages.find((p) => p.id === targetPage.id)!
    expect(updatedPage.blocks.length).toBe(initialBlockCount + 1)
    expect(updatedPage.blocks.at(-1)?.type).toBe('callout')
  })
})
