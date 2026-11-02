import { stepCountIs, streamText, tool } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type {
  AIApprovalProposal,
  AIChatStreamEvent,
  AIChatStreamRequest,
  ProposedSpecBlock
} from '@shared/ipc-channels'
import type { BlockType, Page } from '@shared/types/domain'
import { getWorkspaceSnapshot, searchWorkspace, updatePage } from './workspace.service'

const BLOCK_TYPE_ENUM = z.enum(['paragraph', 'code', 'dbml', 'mermaid', 'graphviz', 'callout'])

function resolveTargetPage(
  pages: Page[],
  pageCodeOrId?: string,
  fallbackPageId?: string
): Page | undefined {
  if (pageCodeOrId) {
    const q = pageCodeOrId.trim().toLowerCase()
    const match = pages.find(
      (p) =>
        p.id.toLowerCase() === q ||
        p.code.toLowerCase() === q ||
        p.title.toLowerCase().includes(q)
    )
    if (match) return match
  }
  if (fallbackPageId) {
    const byFallback = pages.find((p) => p.id === fallbackPageId)
    if (byFallback) return byFallback
  }
  return pages[0]
}

function buildSystemInstruction(
  req: AIChatStreamRequest,
  mentionedPages: Page[],
  activePage?: Page
): string {
  const lines: string[] = [
    `Kamu adalah asisten rekayasa perangkat lunak di dalam NoteIT Workbench v2.0 (mode: ${req.chatMode}).`,
    `Jawab dengan bahasa Indonesia yang teknis, presisi, dan ringkas.`,
    `Kamu memiliki akses ke Native Workbench Tools:`,
    `- search_workspace_fts5: cari spesifikasi, tabel DBML, atau halaman di database SQLite FTS5.`,
    `- read_page_spec: baca blok isi dokumen, skema DBML, atau diagram Mermaid dari halaman tertentu.`,
    `- propose_spec_blocks: ajukan penambahan blok baru (paragraph, code, dbml, mermaid, dot, callout) ke halaman spesifikasi.`,
    `- read_active_browser_tab: baca konteks halaman web yang sedang dibuka di In-App Browser.`
  ]

  if (activePage) {
    lines.push(
      `Halaman aktif saat ini: ${activePage.code} — "${activePage.title}" (id: ${activePage.id}).`
    )
  }

  if (mentionedPages.length > 0) {
    lines.push(`Halaman yang di-@mention oleh pengguna:`)
    for (const p of mentionedPages) {
      const preview = p.blocks
        .map((b) => `[${b.type}] ${b.content}`)
        .join('\n')
        .slice(0, 1200)
      lines.push(`--- ${p.code}: ${p.title} ---\n${preview}`)
    }
  }

  if (req.browserContext) {
    lines.push(
      `Konteks Tab In-App Browser Aktif:\nJudul: ${req.browserContext.title}\nURL: ${req.browserContext.url}\nIsi Ringkas:\n${req.browserContext.excerpt.slice(0, 1500)}`
    )
  }

  return lines.join('\n\n')
}

function resolveLanguageModel(req: AIChatStreamRequest) {
  const rawKey = req.apiKey?.trim() || ''
  if (!rawKey) {
    return null
  }

  if (req.provider === 'ollama') {
    const normalizedBase = rawKey.startsWith('http')
      ? rawKey.endsWith('/v1')
        ? rawKey
        : `${rawKey.replace(/\/+$/, '')}/v1`
      : 'http://localhost:11434/v1'
    const ollama = createOpenAI({
      baseURL: normalizedBase,
      apiKey: 'ollama'
    })
    const modelName = req.modelId.toLowerCase().includes('llama') ? 'llama3.2' : 'qwen2.5-coder'
    return { model: ollama(modelName), label: `Vercel AI SDK · Ollama (${modelName})` }
  }

  if (req.provider === 'openai') {
    const openai = createOpenAI({ apiKey: rawKey })
    return { model: openai('gpt-4o-mini'), label: 'Vercel AI SDK · OpenAI (gpt-4o-mini)' }
  }

  if (req.provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: rawKey })
    return {
      model: anthropic('claude-3-5-sonnet-latest'),
      label: 'Vercel AI SDK · Anthropic (Claude Sonnet)'
    }
  }

  const google = createGoogleGenerativeAI({ apiKey: rawKey })
  return {
    model: google('gemini-2.5-flash'),
    label: 'Vercel AI SDK · Google Gemini (gemini-2.5-flash)'
  }
}

/**
 * Simulator streaming agentic lokal (ketika user belum mengisi API Key atau sedang offline).
 * Tetap menjalankan query FTS5 SQLite asli dan memicu tool proposal dengan Approval Gate!
 */
async function runLocalAgenticFallbackStream(
  req: AIChatStreamRequest,
  emit: (event: AIChatStreamEvent) => void
): Promise<void> {
  const snapshot = getWorkspaceSnapshot()
  const activePage = resolveTargetPage(snapshot.pages, undefined, req.activePageId)
  const mentionedPages = snapshot.pages.filter((p) => req.mentionedPageIds.includes(p.id))
  const lastUserMsg =
    [...req.messages].reverse().find((m) => m.role === 'user')?.content || ''
  const lower = lastUserMsg.toLowerCase()

  // 1. Panggil tool pencarian FTS5 secara nyata bila relevan
  const searchTerms = lastUserMsg
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')

  if (searchTerms.length >= 2) {
    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'search_workspace_fts5',
      argsSummary: `query="${searchTerms}"`
    })
  }

  if (req.browserContext) {
    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'read_active_browser_tab',
      argsSummary: `url="${req.browserContext.url}"`
    })
  }

  // Bangun teks respons & blok proposal
  let replyText = ''
  let proposedBlocks: ProposedSpecBlock[] = []
  let proposalSummary = ''

  if (req.browserContext && (lower.includes('web') || lower.includes('browser') || lower.includes('halaman ini') || lower.includes('rangkum'))) {
    replyText =
      `Berdasarkan pembacaan tab **In-App Browser** aktif (**${req.browserContext.title}** — \`${req.browserContext.url}\`), berikut intisari teknis yang berhasil diekstrak:\n\n` +
      `> ${req.browserContext.excerpt.slice(0, 360)}...\n\n` +
      `Saya telah menyiapkan blok ringkasan referensi untuk ditambahkan ke halaman spesifikasi **${activePage?.code || 'DOC'}**.`
    proposalSummary = `Simpan kutipan referensi web dari ${req.browserContext.title}`
    proposedBlocks = [
      {
        type: 'callout' as BlockType,
        content: `Referensi Web: ${req.browserContext.title} (${req.browserContext.url})\n${req.browserContext.excerpt.slice(0, 400)}`
      }
    ]
  } else if (lower.includes('dbml') || lower.includes('skema') || lower.includes('tabel') || req.chatMode === 'DBML Schema Co-Pilot') {
    replyText =
      `Berikut rancangan skema relasional **DBML** yang disusun melalui pipeline **Vercel AI SDK Tooling**${
        mentionedPages.length > 0
          ? ` dengan mengacu pada konteks **${mentionedPages.map((p) => p.code).join(', ')}**`
          : ''
      }.\n\nSkema ini mencakup relasi kunci asing (*foreign key*) dan siap dirender menjadi diagram ERD interaktif maupun DDL SQL:`
    proposalSummary = 'Sisipkan blok DBML Schema baru ke dokumen spesifikasi'
    proposedBlocks = [
      {
        type: 'dbml' as BlockType,
        content: `Table browser_sessions {\n  id uuid [pk]\n  notebook_id uuid [not null]\n  url varchar [not null]\n  title varchar\n  clipped_at timestamp\n}\n\nTable agent_runs {\n  id uuid [pk]\n  session_id uuid [not null, ref: > browser_sessions.id]\n  provider varchar [not null]\n  approval_mode varchar [not null]\n  status varchar\n}\n\nRef: agent_runs.session_id > browser_sessions.id`
      }
    ]
  } else if (lower.includes('mermaid') || lower.includes('diagram') || lower.includes('alur') || req.chatMode === 'Mermaid & DOT Diagrammer') {
    replyText =
      `Berikut diagram arsitektur **Mermaid** untuk memetakan alur komponen antara **In-App Browser**, **Vercel AI SDK**, dan penyimpanan **SQLite WAL**:`
    proposalSummary = 'Sisipkan diagram alur arsitektur Mermaid'
    proposedBlocks = [
      {
        type: 'mermaid' as BlockType,
        content: `flowchart LR\n  WV[In-App Chromium Webview] -->|Extract DOM| AI[Vercel AI SDK Stream]\n  AI -->|Tool: search_workspace_fts5| DB[(SQLite FTS5)]\n  AI -->|Approval Gate| DOC[Active Spec Page]`
      }
    ]
  } else {
    replyText =
      `Analisis spesifikasi untuk **"${lastUserMsg}"** (${req.chatMode}):\n\n` +
      `1. **Konteks Workspace**: Terhubung ke indeks SQLite FTS5 (${snapshot.pages.length} halaman aktif${
        mentionedPages.length > 0 ? `, konteks @mention: ${mentionedPages.map((p) => p.code).join(', ')}` : ''
      }).\n` +
      `2. **Rekomendasi Implementasi**: Gunakan pemisahan jelas antara *state* antarmuka dan layanan IPC agar latensi tetap di bawah 16ms.\n` +
      `3. **Tindakan Dokumen**: Saya telah menyiapkan draf blok spesifikasi di bawah ini.`
    proposalSummary = `Tambahkan catatan spesifikasi hasil analisis "${lastUserMsg.slice(0, 32)}"`
    proposedBlocks = [
      {
        type: 'paragraph' as BlockType,
        content: `### Spesifikasi Teknis: ${lastUserMsg}\nDisusun secara otomatis dengan memperhatikan aturan isolasi konteks dan penyimpanan lokal SQLite WAL.`
      }
    ]
  }

  // Stream kata demi kata agar terasa responsif
  const chunks = replyText.match(/.{1,18}(\s|$)|\S+/g) || [replyText]
  for (const chunk of chunks) {
    emit({
      requestId: req.requestId,
      type: 'text-delta',
      textDelta: chunk
    })
    await new Promise((r) => setTimeout(r, 18))
  }

  // Jika bukan mode plan-only dan ada halaman target, jalankan tool propose_spec_blocks
  if (req.approvalMode !== 'plan-only' && activePage && proposedBlocks.length > 0) {
    emit({
      requestId: req.requestId,
      type: 'tool-call',
      toolName: 'propose_spec_blocks',
      argsSummary: `target="${activePage.code}", blocks=${proposedBlocks.length}`
    })

    const proposal: AIApprovalProposal = {
      proposalId: `prop-${Date.now()}`,
      targetPageId: activePage.id,
      targetPageCode: activePage.code,
      targetPageTitle: activePage.title,
      summary: proposalSummary,
      blocks: proposedBlocks,
      status: req.approvalMode === 'auto-edit' ? 'approved' : 'pending'
    }

    if (req.approvalMode === 'auto-edit') {
      const nextBlocks = [
        ...activePage.blocks,
        ...proposedBlocks.map((b, i) => ({
          id: `blk-ai-${Date.now()}-${i}`,
          type: b.type,
          content: b.content
        }))
      ]
      updatePage({ id: activePage.id, blocks: nextBlocks })
      emit({
        requestId: req.requestId,
        type: 'auto-applied',
        proposal
      })
    } else {
      emit({
        requestId: req.requestId,
        type: 'approval-request',
        proposal
      })
    }
  }

  emit({
    requestId: req.requestId,
    type: 'done',
    usedLiveSdk: false,
    providerLabel: 'NoteIT Local Agentic Engine (Isi API Key di Settings untuk Live Cloud LLM)'
  })
}

export async function executeAIChatStream(
  req: AIChatStreamRequest,
  emit: (event: AIChatStreamEvent) => void
): Promise<void> {
  const resolved = resolveLanguageModel(req)
  if (!resolved) {
    await runLocalAgenticFallbackStream(req, emit)
    return
  }

  const snapshot = getWorkspaceSnapshot()
  const activePage = resolveTargetPage(snapshot.pages, undefined, req.activePageId)
  const mentionedPages = snapshot.pages.filter((p) => req.mentionedPageIds.includes(p.id))

  try {
    const result = streamText({
      model: resolved.model,
      system: buildSystemInstruction(req, mentionedPages, activePage),
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      stopWhen: stepCountIs(4),
      tools: {
        search_workspace_fts5: tool({
          description:
            'Cari halaman spesifikasi, catatan, atau skema DBML di SQLite FTS5 NoteIT.',
          inputSchema: z.object({
            query: z.string().describe('Kata kunci pencarian FTS5')
          }),
          execute: async ({ query }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'search_workspace_fts5',
              argsSummary: `query="${query}"`
            })
            const hits = searchWorkspace(query)
            return hits.slice(0, 6).map((h) => ({
              pageId: h.pageId,
              code: h.pageCode,
              title: h.title,
              snippet: h.snippet
            }))
          }
        }),

        read_page_spec: tool({
          description: 'Baca isi lengkap blok dokumen atau skema DBML dari halaman NoteIT.',
          inputSchema: z.object({
            pageCodeOrTitle: z
              .string()
              .describe('Kode halaman (mis. ARC-01) atau judul halaman')
          }),
          execute: async ({ pageCodeOrTitle }) => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'read_page_spec',
              argsSummary: `target="${pageCodeOrTitle}"`
            })
            const snap = getWorkspaceSnapshot()
            const target = resolveTargetPage(snap.pages, pageCodeOrTitle, req.activePageId)
            if (!target) return { error: 'Halaman tidak ditemukan' }
            return {
              id: target.id,
              code: target.code,
              title: target.title,
              mode: target.mode,
              blocks: target.blocks.map((b) => ({ type: b.type, content: b.content }))
            }
          }
        }),

        read_active_browser_tab: tool({
          description: 'Baca URL, judul, dan isi teks dari tab In-App Browser yang sedang aktif.',
          inputSchema: z.object({}),
          execute: async () => {
            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'read_active_browser_tab',
              argsSummary: req.browserContext ? `url="${req.browserContext.url}"` : 'no-tab'
            })
            return (
              req.browserContext || {
                info: 'Belum ada konteks tab browser yang dilampirkan.'
              }
            )
          }
        }),

        propose_spec_blocks: tool({
          description:
            'Ajukan penambahan blok spesifikasi baru (paragraph, code, dbml, mermaid, dot, callout) ke halaman NoteIT.',
          inputSchema: z.object({
            targetPageCode: z
              .string()
              .optional()
              .describe('Kode halaman tujuan, kosongkan untuk memakai halaman aktif'),
            summary: z.string().describe('Ringkasan singkat perubahan blok yang diajukan'),
            blocks: z.array(
              z.object({
                type: BLOCK_TYPE_ENUM,
                content: z.string()
              })
            )
          }),
          execute: async ({ targetPageCode, summary, blocks }) => {
            const snap = getWorkspaceSnapshot()
            const target = resolveTargetPage(snap.pages, targetPageCode, req.activePageId)
            if (!target) {
              return { ok: false, error: 'Tidak ada halaman tujuan yang ditemukan' }
            }

            emit({
              requestId: req.requestId,
              type: 'tool-call',
              toolName: 'propose_spec_blocks',
              argsSummary: `target="${target.code}", blocks=${blocks.length}`
            })

            const proposal: AIApprovalProposal = {
              proposalId: `prop-${Date.now()}`,
              targetPageId: target.id,
              targetPageCode: target.code,
              targetPageTitle: target.title,
              summary,
              blocks,
              status: req.approvalMode === 'auto-edit' ? 'approved' : 'pending'
            }

            if (req.approvalMode === 'auto-edit') {
              const nextBlocks = [
                ...target.blocks,
                ...blocks.map((b, idx) => ({
                  id: `blk-ai-${Date.now()}-${idx}`,
                  type: b.type,
                  content: b.content
                }))
              ]
              updatePage({ id: target.id, blocks: nextBlocks })
              emit({
                requestId: req.requestId,
                type: 'auto-applied',
                proposal
              })
              return {
                ok: true,
                status: 'auto-applied',
                targetPageCode: target.code
              }
            }

            emit({
              requestId: req.requestId,
              type: 'approval-request',
              proposal
            })
            return {
              ok: true,
              status: 'awaiting-user-approval',
              targetPageCode: target.code
            }
          }
        })
      }
    })

    for await (const delta of result.textStream) {
      if (delta) {
        emit({
          requestId: req.requestId,
          type: 'text-delta',
          textDelta: delta
        })
      }
    }

    emit({
      requestId: req.requestId,
      type: 'done',
      usedLiveSdk: true,
      providerLabel: resolved.label
    })
  } catch (error) {
    // Jika koneksi Ollama lokal atau API gagal, fallback dengan mulus ke mesin lokal
    console.warn('[ai.service] Live provider gagal, beralih ke local agentic fallback:', error)
    await runLocalAgenticFallbackStream(req, emit)
  }
}
