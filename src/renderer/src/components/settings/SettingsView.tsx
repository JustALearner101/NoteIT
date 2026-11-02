import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  HelpCircle,
  Keyboard,
  Layers,
  LayoutTemplate,
  Lock,
  MessageSquare,
  Mic,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
  Upload,
  Wand2,
  Zap
} from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import {
  applyThemeToDocument,
  BUILTIN_THEMES,
  type MotionLevel,
  type ThemeColors,
  type ThemeDefinition
} from '@renderer/lib/themes'
import { MARKER_META } from '@renderer/lib/marker-colors'

interface NavItem {
  id: string
  label: string
  badge?: 'Optional' | 'Beta' | 'Alpha'
  keywords: string
  icon: React.ReactNode
}

interface NavGroup {
  groupTitle?: string
  items: NavItem[]
}

const SETTINGS_GROUPS: NavGroup[] = [
  {
    items: [
      {
        id: 'onboarding',
        label: 'Onboarding checklist',
        keywords: 'onboarding setup mulai checklist panduan',
        icon: <CheckCircle2 size={14} />
      }
    ]
  },
  {
    groupTitle: 'AI Capabilities',
    items: [
      {
        id: 'ai-agents',
        label: 'Agents',
        keywords: 'agents ai persona spec dbml assistant',
        icon: <Bot size={14} />
      },
      {
        id: 'ai-providers',
        label: 'AI Provider Accounts',
        badge: 'Optional',
        keywords: 'api key openai gemini anthropic claude ollama model',
        icon: <Sparkles size={14} />
      },
      {
        id: 'ai-orchestration',
        label: 'Orchestration',
        keywords: 'orchestration multi agent workflow pipeline',
        icon: <Layers size={14} />
      },
      {
        id: 'ai-computer-use',
        label: 'Computer Use',
        keywords: 'computer use desktop automation sandbox',
        icon: <Monitor size={14} />
      },
      {
        id: 'ai-voice',
        label: 'Voice',
        keywords: 'voice dictation mikrofon transkripsi suara',
        icon: <Mic size={14} />
      }
    ]
  },
  {
    groupTitle: 'Set Up',
    items: [
      {
        id: 'general',
        label: 'General',
        keywords: 'general umum bahasa startup autosave profil',
        icon: <Settings2 size={14} />
      },
      {
        id: 'storage-backup',
        label: 'Storage & Backup',
        keywords: 'sqlite wal database backup vacuum export folder',
        icon: <Database size={14} />
      },
      {
        id: 'integrations',
        label: 'Integrations',
        keywords: 'integrations git markdown sql export',
        icon: <Code2 size={14} />
      }
    ]
  },
  {
    groupTitle: 'Workflows',
    items: [
      {
        id: 'automations',
        label: 'Automations',
        keywords: 'automations daily note jadwal otomatis',
        icon: <Zap size={14} />
      },
      {
        id: 'artifacts',
        label: 'Artifacts',
        badge: 'Beta',
        keywords: 'artifacts template halaman dbml mermaid',
        icon: <LayoutTemplate size={14} />
      },
      {
        id: 'quick-commands',
        label: 'Quick Commands',
        keywords: 'quick capture command palette ctrl k',
        icon: <Terminal size={14} />
      },
      {
        id: 'browser',
        label: 'Browser',
        badge: 'Beta',
        keywords: 'browser web in-app referensi',
        icon: <Globe size={14} />
      },
      {
        id: 'mockup-studio',
        label: 'UI Mockup Studio',
        badge: 'Beta',
        keywords: 'mockup ui design wireframe canvas',
        icon: <Wand2 size={14} />
      }
    ]
  },
  {
    groupTitle: 'Interface',
    items: [
      {
        id: 'appearance',
        label: 'Appearance',
        keywords: 'appearance theme warna preset custom dark light animasi motion font grid',
        icon: <Palette size={14} />
      },
      {
        id: 'chat',
        label: 'Chat',
        keywords: 'chat free chat approval model prompt',
        icon: <MessageSquare size={14} />
      },
      {
        id: 'input-editing',
        label: 'Input & Editing',
        keywords: 'input editing spellcheck editor block canvas',
        icon: <Sliders size={14} />
      },
      {
        id: 'shortcuts',
        label: 'Shortcuts',
        keywords: 'shortcuts keyboard hotkey ctrl pintasan',
        icon: <Keyboard size={14} />
      },
      {
        id: 'stats-usage',
        label: 'Stats & Usage',
        keywords: 'stats usage statistik halaman blok kata fts5',
        icon: <Cpu size={14} />
      }
    ]
  },
  {
    groupTitle: 'Privacy & Security',
    items: [
      {
        id: 'privacy',
        label: 'Privacy & Telemetry',
        keywords: 'privacy security offline local-first csp',
        icon: <ShieldCheck size={14} />
      }
    ]
  },
  {
    groupTitle: 'Advanced & Experimental',
    items: [
      {
        id: 'advanced',
        label: 'Advanced',
        keywords: 'advanced gc orphan assets logs diagnostics',
        icon: <Lock size={14} />
      },
      {
        id: 'plugins',
        label: 'Plugins',
        badge: 'Alpha',
        keywords: 'plugins ekstensi alpha custom block',
        icon: <Sparkles size={14} />
      }
    ]
  }
]

const ONBOARDING_STEPS = [
  {
    id: 'create-notebook',
    title: 'Buat atau jelajahi Notebook proyek',
    desc: 'Organisasikan spesifikasi sistem ke dalam Notebook dan Section berwarna.',
    actionLabel: 'Buka Workbench',
    targetView: 'workbench' as const
  },
  {
    id: 'block-editor',
    title: 'Tulis spesifikasi dengan Block Editor & DBML',
    desc: 'Gunakan blok teks, kode, DBML Schema, Mermaid, dan Graphviz DOT.',
    actionLabel: 'Buka Editor',
    targetView: 'workbench' as const
  },
  {
    id: 'try-themes',
    title: 'Personalisasi tampilan di Theme Studio',
    desc: 'Coba preset Orca Carbon, Code.Zone Amber, Finns Cosmic Nebula, atau buat tema kustom.',
    actionLabel: 'Pilih Tema',
    targetSection: 'appearance'
  },
  {
    id: 'try-ai-chat',
    title: 'Mulai sesi di halaman AI Chat (Free chat)',
    desc: 'Gunakan @mention untuk melampirkan halaman spesifikasi sebagai konteks diskusi.',
    actionLabel: 'Buka AI Chat',
    targetView: 'ai-chat' as const
  },
  {
    id: 'try-split-pane',
    title: 'Bandingkan dua dokumen dengan Split-Pane',
    desc: 'Tahan Alt+Klik pada halaman di sidebar untuk membuka dokumen berdampingan.',
    actionLabel: 'Aktifkan Split',
    splitAction: true
  },
  {
    id: 'read-help-html',
    title: 'Buka dokumentasi Help Center (?) di browser',
    desc: 'Pelajari sintaks DBML, Mermaid, dan daftar shortcut di halaman HTML statis.',
    actionLabel: 'Buka Help HTML',
    helpAction: true
  }
]

export const SettingsView: React.FC = () => {
  const {
    notebooks,
    sections,
    pages,
    tags,
    stats,
    activeSettingsSection,
    setActiveSettingsSection,
    setActiveMainView,
    preferences,
    setActiveTheme,
    saveCustomTheme,
    deleteCustomTheme,
    updatePreferences,
    toggleOnboardingItem,
    toggleSplitPane,
    toggleBrowserSplitPane,
    openHelpCenter,
    showToast
  } = useWorkspaceStore()

  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // State untuk Custom Theme Studio
  const activeThemeObj = useMemo(
    () =>
      [...BUILTIN_THEMES, ...preferences.customThemes].find(
        (t) => t.id === preferences.activeThemeId
      ) || BUILTIN_THEMES[0],
    [preferences.activeThemeId, preferences.customThemes]
  )

  const [customName, setCustomName] = useState('My Custom Studio')
  const [customScheme, setCustomScheme] = useState<'dark' | 'light'>('dark')
  const [customGlow, setCustomGlow] = useState(true)
  const [customColors, setCustomColors] = useState<ThemeColors>(activeThemeObj.colors)
  const [importJsonText, setImportJsonText] = useState('')
  const [isImportingJson, setIsImportingJson] = useState(false)

  // Sinkronisasi warna dasar builder saat user klik "Salin ke Custom Builder"
  const loadThemeIntoBuilder = (theme: ThemeDefinition): void => {
    setCustomName(`${theme.name} Custom`)
    setCustomScheme(theme.colorScheme)
    setCustomGlow(theme.ambientGlow)
    setCustomColors({ ...theme.colors })
    showToast(`Palet '${theme.name}' dimuat ke Custom Theme Studio`)
  }

  // Shortcut Ctrl+F fokus ke Search Settings, Esc kembali ke aplikasi
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setActiveMainView('workbench')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveMainView])

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return SETTINGS_GROUPS
    return SETTINGS_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keywords.toLowerCase().includes(q) ||
          (g.groupTitle && g.groupTitle.toLowerCase().includes(q))
      )
    })).filter((g) => g.items.length > 0)
  }, [searchQuery])

  const handlePreviewCustomTheme = (): void => {
    const tempTheme: ThemeDefinition = {
      id: 'preview-custom',
      name: customName || 'Preview Theme',
      tagline: 'Live Preview',
      colorScheme: customScheme,
      ambientGlow: customGlow,
      isCustom: true,
      colors: customColors
    }
    applyThemeToDocument(tempTheme, preferences.motionLevel, preferences.fontScale)
    showToast('Menampilkan pratinjau langsung tema kustom')
  }

  const handleSaveCustomTheme = (): void => {
    const slug =
      'custom-' +
      (customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || Date.now().toString())
    const newTheme: ThemeDefinition = {
      id: slug,
      name: customName.trim() || 'Custom Theme',
      tagline: 'Tema kustom buatan pengguna',
      badge: 'Custom',
      colorScheme: customScheme,
      ambientGlow: customGlow,
      isCustom: true,
      colors: customColors
    }
    saveCustomTheme(newTheme)
  }

  const handleExportCustomThemeJson = (): void => {
    const payload = JSON.stringify(
      {
        name: customName,
        colorScheme: customScheme,
        ambientGlow: customGlow,
        colors: customColors
      },
      null,
      2
    )
    navigator.clipboard?.writeText(payload)
    showToast('JSON Tema disalin ke clipboard!')
  }

  const handleImportCustomThemeJson = (): void => {
    try {
      const parsed = JSON.parse(importJsonText)
      if (!parsed || typeof parsed !== 'object' || !parsed.colors) {
        showToast('Format JSON tema tidak valid')
        return
      }
      const imported: ThemeDefinition = {
        id: 'custom-' + Date.now(),
        name: parsed.name || 'Imported Theme',
        tagline: 'Tema hasil impor JSON',
        badge: 'Imported',
        colorScheme: parsed.colorScheme === 'light' ? 'light' : 'dark',
        ambientGlow: Boolean(parsed.ambientGlow),
        isCustom: true,
        colors: {
          ...activeThemeObj.colors,
          ...parsed.colors
        }
      }
      saveCustomTheme(imported)
      setImportJsonText('')
      setIsImportingJson(false)
    } catch {
      showToast('Gagal mem-parsing JSON tema')
    }
  }

  const handleRunBackupNow = async (): Promise<void> => {
    const res = await window.noteitAPI.runBackupNow()
    if (res.ok) {
      showToast(`Backup berhasil dibuat: ${res.filePath}`)
    } else {
      showToast(`Backup gagal: ${res.error || 'Unknown error'}`)
    }
  }

  const handleGcAssets = async (): Promise<void> => {
    const res = await window.noteitAPI.gcOrphanAssetsNow()
    showToast(`Pembersihan selesai: ${res.deletedCount} aset yatim dihapus`)
  }

  // Hitung statistik workspace untuk menu Stats & Usage
  const totalBlocks = useMemo(
    () => pages.reduce((acc, p) => acc + p.blocks.length, 0),
    [pages]
  )
  const totalWords = useMemo(() => {
    return pages.reduce((acc, p) => {
      const text = p.blocks.map((b) => b.content).join(' ')
      const count = text.trim().split(/\s+/).filter(Boolean).length
      return acc + count
    }, 0)
  }, [pages])

  const renderBadge = (badge?: 'Optional' | 'Beta' | 'Alpha'): React.ReactNode => {
    if (!badge) return null
    const styles =
      badge === 'Optional'
        ? 'bg-surface-elevated text-ink-muted border-border-hairline'
        : badge === 'Beta'
          ? 'bg-accent-cobalt/15 text-accent-cobalt border-accent-cobalt/30'
          : 'bg-accent-amber/15 text-accent-amber border-accent-amber/30'
    return (
      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${styles}`}>
        {badge}
      </span>
    )
  }

  const renderActivePanel = (): React.ReactNode => {
    // Jika user memilih salah satu Notebook di bawah seksi Projects
    if (activeSettingsSection.startsWith('notebook:')) {
      const nbId = activeSettingsSection.replace('notebook:', '')
      const nb = notebooks.find((n) => n.id === nbId) || notebooks[0]
      const nbSections = sections.filter((s) => s.notebookId === nb?.id)
      const nbPages = pages.filter((p) => nbSections.some((s) => s.id === p.sectionId))

      if (!nb) return null
      return (
        <div className="space-y-6 animate-view-enter">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{nb.icon}</span>
              <h1 className="font-display text-xl font-bold text-ink-primary">{nb.name}</h1>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-elevated border border-border-hairline text-accent-cobalt">
                Project Notebook
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-1">
              Konfigurasi spesifik proyek dan ringkasan hierarki dokumen untuk notebook ini.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-surface-elevated border border-border-hairline">
              <div className="font-mono text-[10px] text-ink-muted uppercase">SECTIONS</div>
              <div className="font-display text-2xl font-bold text-ink-primary mt-1">
                {nbSections.length}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-surface-elevated border border-border-hairline">
              <div className="font-mono text-[10px] text-ink-muted uppercase">TOTAL PAGES</div>
              <div className="font-display text-2xl font-bold text-ink-primary mt-1">
                {nbPages.length}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-surface-elevated border border-border-hairline">
              <div className="font-mono text-[10px] text-ink-muted uppercase">MARKER COLOR</div>
              <div className="font-mono text-sm font-semibold text-ink-primary mt-2 uppercase flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${MARKER_META[nb.color].bgStrip}`} />
                <span>{nb.color}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface-elevated border border-border-hairline space-y-3">
            <h2 className="font-display text-sm font-semibold text-ink-primary">
              Daftar Section di {nb.name}
            </h2>
            <div className="divide-y divide-border-subtle">
              {nbSections.map((sec) => {
                const count = nbPages.filter((p) => p.sectionId === sec.id).length
                return (
                  <div key={sec.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-4 rounded-full ${MARKER_META[sec.color].bgStrip}`}
                      />
                      <span className="font-medium text-ink-primary">{sec.name}</span>
                      <span className="font-mono text-[10px] text-ink-muted">{sec.code}</span>
                    </div>
                    <span className="font-mono text-[11px] text-ink-secondary">
                      {count} halaman
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    switch (activeSettingsSection) {
      case 'onboarding': {
        const doneCount = preferences.onboardingDone.length
        return (
          <div className="space-y-6 animate-view-enter">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl font-bold text-ink-primary">
                  Onboarding checklist
                </h1>
                <p className="text-xs text-ink-secondary mt-1">
                  Kenali fitur utama NoteIT Workbench v2.0 untuk alur kerja spesifikasi &amp; arsitektur.
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-surface-elevated border border-border-hairline font-mono text-xs text-accent-cobalt">
                {doneCount} / {ONBOARDING_STEPS.length} Selesai
              </div>
            </div>

            <div className="space-y-2.5">
              {ONBOARDING_STEPS.map((step) => {
                const isDone = preferences.onboardingDone.includes(step.id)
                return (
                  <div
                    key={step.id}
                    className={`p-4 rounded-lg border transition-colors flex items-center justify-between gap-4 ${
                      isDone
                        ? 'bg-surface-elevated/60 border-border-subtle'
                        : 'bg-surface-elevated border-border-hairline'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleOnboardingItem(step.id)}
                        className="mt-0.5 text-accent-cobalt hover:scale-110 transition-transform"
                        title="Tandai selesai / belum"
                      >
                        {isDone ? (
                          <CheckCircle2 size={18} className="text-accent-cobalt" />
                        ) : (
                          <Circle size={18} className="text-ink-muted" />
                        )}
                      </button>
                      <div>
                        <div
                          className={`text-sm font-medium ${
                            isDone ? 'line-through text-ink-secondary' : 'text-ink-primary'
                          }`}
                        >
                          {step.title}
                        </div>
                        <div className="text-xs text-ink-secondary mt-0.5">{step.desc}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!isDone) toggleOnboardingItem(step.id)
                        if (step.targetSection) {
                          setActiveSettingsSection(step.targetSection)
                        } else if (step.targetView) {
                          setActiveMainView(step.targetView)
                        } else if (step.splitAction) {
                          setActiveMainView('workbench')
                          toggleSplitPane()
                        } else if (step.helpAction) {
                          void openHelpCenter()
                        }
                      }}
                      className="px-3 py-1.5 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-primary shrink-0 transition-colors"
                    >
                      {step.actionLabel}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      case 'appearance': {
        const allThemes = [...BUILTIN_THEMES, ...preferences.customThemes]
        return (
          <div className="space-y-8 animate-view-enter">
            <div>
              <h1 className="font-display text-xl font-bold text-ink-primary">
                Appearance &amp; Theme Studio
              </h1>
              <p className="text-xs text-ink-secondary mt-1">
                Pilih dari preset kurasi (termasuk Orca Carbon, Code.Zone Amber, dan Finns Cosmic Nebula) atau racik tema kustom lu sendiri.
              </p>
            </div>

            {/* Theme Presets Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-ink-primary">
                  Theme Presets ({allThemes.length})
                </h2>
                <span className="font-mono text-[11px] text-ink-muted">
                  Aktif: <strong className="text-accent-cobalt">{activeThemeObj.name}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {allThemes.map((t) => {
                  const isSelected = t.id === preferences.activeThemeId
                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveTheme(t.id)}
                      className={`group rounded-lg p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-accent-cobalt ring-1 ring-accent-cobalt bg-surface-elevated shadow-lg'
                          : 'border-border-hairline bg-surface-elevated/60 hover:bg-surface-elevated hover:border-ink-muted'
                      }`}
                    >
                      <div>
                        {/* Mini Visual Swatch Window */}
                        <div
                          className="h-20 rounded-md border overflow-hidden mb-2.5 flex flex-col justify-between p-2 relative"
                          style={{
                            backgroundColor: t.colors.bgCanvasPrimary,
                            borderColor: t.colors.borderHairline,
                            backgroundImage: t.ambientGlow
                              ? `radial-gradient(circle at 50% 0%, ${t.colors.glowPrimary || 'rgba(168,85,247,0.28)'}, transparent 70%)`
                              : undefined
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: t.colors.accentCobalt }}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: t.colors.accentAmber }}
                              />
                            </div>
                            {t.badge && (
                              <span
                                className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: t.colors.bgSurfaceElevated,
                                  color: t.colors.textPrimary,
                                  border: `1px solid ${t.colors.borderHairline}`
                                }}
                              >
                                {t.badge}
                              </span>
                            )}
                          </div>

                          <div
                            className="rounded px-2 py-1 flex items-center justify-between"
                            style={{
                              backgroundColor: t.colors.bgSurfaceElevated,
                              border: `1px solid ${t.colors.borderHairline}`
                            }}
                          >
                            <span
                              className="font-mono text-[10px] truncate"
                              style={{ color: t.colors.textPrimary }}
                            >
                              Aa · {t.colorScheme.toUpperCase()}
                            </span>
                            <span
                              className="font-mono text-[9px]"
                              style={{ color: t.colors.accentCobalt }}
                            >
                              {t.colors.accentCobalt}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-semibold text-xs text-ink-primary flex items-center gap-1.5">
                            {t.name}
                            {isSelected && <Check size={13} className="text-accent-cobalt" />}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                loadThemeIntoBuilder(t)
                              }}
                              title="Salin warna ke Custom Theme Studio"
                              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-chrome hover:bg-surface-hover text-ink-secondary hover:text-ink-primary border border-border-hairline"
                            >
                              Kloning
                            </button>
                            {t.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteCustomTheme(t.id)
                                }}
                                title="Hapus tema kustom"
                                className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-[#EF4444]"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-ink-secondary mt-1 line-clamp-2">
                          {t.tagline}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Custom Theme Studio */}
            <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-semibold text-ink-primary flex items-center gap-2">
                    <Sparkles size={15} className="text-accent-cobalt" />
                    <span>Custom Theme Studio</span>
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Sesuaikan setiap token warna, nyalakan efek Aurora Glow, lalu simpan sebagai preset pribadi.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCustomThemeJson}
                    className="px-2.5 py-1.5 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5"
                  >
                    <Download size={12} />
                    <span>Salin JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportingJson(!isImportingJson)}
                    className="px-2.5 py-1.5 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5"
                  >
                    <Upload size={12} />
                    <span>Impor JSON</span>
                  </button>
                </div>
              </div>

              {isImportingJson && (
                <div className="p-3 rounded-lg bg-surface-chrome border border-border-hairline space-y-2">
                  <textarea
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    rows={4}
                    placeholder='Paste JSON tema di sini (mis. {"name": "Cyber", "colors": {...}})...'
                    className="w-full p-2 rounded bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary focus:outline-none focus:border-accent-cobalt"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsImportingJson(false)}
                      className="px-2.5 py-1 rounded text-xs text-ink-secondary hover:text-ink-primary"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleImportCustomThemeJson}
                      className="px-3 py-1 rounded bg-accent-cobalt text-white text-xs font-medium"
                    >
                      Terapkan JSON
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Nama Tema Kustom
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus:outline-none focus:border-accent-cobalt"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Mode Dasar (Color Scheme)
                  </label>
                  <select
                    value={customScheme}
                    onChange={(e) =>
                      setCustomScheme(e.target.value === 'light' ? 'light' : 'dark')
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus:outline-none"
                  >
                    <option value="dark">Dark Scheme</option>
                    <option value="light">Light Scheme</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Ambient Aurora Glow
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomGlow(!customGlow)}
                    className={`w-full px-2.5 py-1.5 rounded border text-xs font-medium flex items-center justify-between ${
                      customGlow
                        ? 'bg-accent-cobalt/15 border-accent-cobalt text-accent-cobalt'
                        : 'bg-surface-chrome border-border-hairline text-ink-secondary'
                    }`}
                  >
                    <span>{customGlow ? 'Aktif (Ala Finns Nebula)' : 'Nonaktif (Matte)'}</span>
                    <span>{customGlow ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              {/* Color Token Pickers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {(
                  [
                    ['bgCanvasPrimary', 'Canvas Background'],
                    ['bgSurfaceChrome', 'Sidebar / Chrome'],
                    ['bgSurfaceElevated', 'Elevated Card'],
                    ['borderHairline', 'Hairline Border'],
                    ['textPrimary', 'Primary Ink'],
                    ['textSecondary', 'Secondary Ink'],
                    ['accentCobalt', 'Primary Accent'],
                    ['accentAmber', 'Secondary Accent']
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="p-2 rounded-lg bg-surface-chrome border border-border-hairline flex items-center gap-2.5"
                  >
                    <input
                      type="color"
                      value={customColors[key]}
                      onChange={(e) =>
                        setCustomColors((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-ink-primary truncate">
                        {label}
                      </div>
                      <input
                        type="text"
                        value={customColors[key]}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-full bg-transparent font-mono text-[10px] text-ink-secondary focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handlePreviewCustomTheme}
                  className="px-3 py-1.5 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5"
                >
                  <Eye size={13} />
                  <span>Preview Live</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomTheme}
                  className="px-3.5 py-1.5 rounded-md bg-accent-cobalt hover:opacity-90 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  <span>Simpan &amp; Pakai Tema</span>
                </button>
              </div>
            </div>

            {/* Motion & Animation Settings */}
            <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
              <div>
                <h2 className="font-display text-sm font-semibold text-ink-primary">
                  Animasi &amp; Kenyamanan Visual
                </h2>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Atur intensitas transisi antarmuka, ukuran tipografi, dan visibilitas grid kanvas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Intensitas Animasi (Motion)
                  </label>
                  <select
                    value={preferences.motionLevel}
                    onChange={(e) =>
                      updatePreferences({ motionLevel: e.target.value as MotionLevel })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
                  >
                    <option value="full">Full Motion (Presisi &amp; Snappy)</option>
                    <option value="subtle">Subtle (Transisi Cepat)</option>
                    <option value="off">Off / Instant (Tanpa Animasi)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Skala Ukuran Teks
                  </label>
                  <select
                    value={preferences.fontScale}
                    onChange={(e) =>
                      updatePreferences({
                        fontScale: e.target.value as 'compact' | 'default' | 'comfortable'
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
                  >
                    <option value="compact">Compact (15px)</option>
                    <option value="default">Default (16px)</option>
                    <option value="comfortable">Comfortable (17px)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    24px Blueprint Crosshair Grid
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updatePreferences({ showBlueprintGrid: !preferences.showBlueprintGrid })
                    }
                    className={`w-full px-2.5 py-1.5 rounded border text-xs font-medium flex items-center justify-between ${
                      preferences.showBlueprintGrid
                        ? 'bg-accent-cobalt/15 border-accent-cobalt text-accent-cobalt'
                        : 'bg-surface-chrome border-border-hairline text-ink-secondary'
                    }`}
                  >
                    <span>{preferences.showBlueprintGrid ? 'Ditampilkan' : 'Disembunyikan'}</span>
                    <span>{preferences.showBlueprintGrid ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      case 'ai-providers':
      case 'ai-agents':
      case 'ai-orchestration':
      case 'ai-computer-use':
      case 'ai-voice':
      case 'chat': {
        return (
          <div className="space-y-6 animate-view-enter">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold text-ink-primary">
                  AI Capabilities &amp; Free Chat Configuration
                </h1>
                {renderBadge('Optional')}
              </div>
              <p className="text-xs text-ink-secondary mt-1">
                Atur provider model, kebijakan persetujuan tindakan (Approval Mode), dan perilaku halaman AI Chat.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Default AI Provider
                  </label>
                  <select
                    value={preferences.aiProvider}
                    onChange={(e) =>
                      updatePreferences({
                        aiProvider: e.target.value as
                          | 'gemini'
                          | 'openai'
                          | 'anthropic'
                          | 'ollama'
                      })
                    }
                    className="w-full px-3 py-2 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
                  >
                    <option value="gemini">Google Gemini (Recommended)</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="ollama">Ollama Local (100% Offline)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                    Default Approval Policy
                  </label>
                  <select
                    value={preferences.aiApprovalMode}
                    onChange={(e) =>
                      updatePreferences({
                        aiApprovalMode: e.target.value as 'ask' | 'auto-edit' | 'plan-only'
                      })
                    }
                    className="w-full px-3 py-2 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
                  >
                    <option value="ask">Ask for approval (Tanyakan sebelum edit halaman)</option>
                    <option value="auto-edit">Auto-insert blocks (Langsung sisipkan blok)</option>
                    <option value="plan-only">Plan &amp; Discuss only (Hanya diskusi)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-ink-muted mb-1">
                  API Key / Local Endpoint (Opsional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={preferences.aiApiKeyMasked}
                    onChange={(e) => updatePreferences({ aiApiKeyMasked: e.target.value })}
                    placeholder="sk-... atau http://localhost:11434 (kosongkan untuk mode simulasi lokal)"
                    className="flex-1 px-3 py-1.5 rounded bg-surface-chrome border border-border-hairline font-mono text-xs text-ink-primary focus:outline-none focus:border-accent-cobalt"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveMainView('ai-chat')}
                    className="px-3 py-1.5 rounded bg-accent-cobalt text-white text-xs font-medium"
                  >
                    Buka AI Chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      case 'storage-backup': {
        return (
          <div className="space-y-6 animate-view-enter">
            <div>
              <h1 className="font-display text-xl font-bold text-ink-primary">
                Storage, SQLite WAL &amp; Automatic Backups
              </h1>
              <p className="text-xs text-ink-secondary mt-1">
                Kelola database SQLite lokal, indeks pencarian FTS5, serta rotasi cadangan otomatis.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase text-ink-muted">
                    LOKASI DATABASE AKTIF
                  </div>
                  <div className="font-mono text-xs text-ink-primary mt-1 break-all">
                    {stats.dbPath || 'Local UserData Workspace (SQLite WAL)'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] font-mono text-[11px]">
                  WAL ONLINE · {stats.ftsIndexedPages} PAGES INDEXED
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRunBackupNow}
                  className="px-3.5 py-2 rounded-md bg-accent-cobalt text-white text-xs font-medium flex items-center gap-2"
                >
                  <RefreshCw size={13} />
                  <span>Jalankan Backup Sekarang (VACUUM INTO)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.noteitAPI.openStorageFolder('workspace')}
                  className="px-3 py-2 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5"
                >
                  <FolderOpen size={13} />
                  <span>Buka Folder Workspace</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.noteitAPI.openStorageFolder('backups')}
                  className="px-3 py-2 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5"
                >
                  <FolderOpen size={13} />
                  <span>Buka Folder Backups</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      case 'shortcuts': {
        const shortcuts = [
          ['Command Palette & FTS5 Instant Search', 'Ctrl + K'],
          ['Buka / Tutup Settings', 'Ctrl + ,'],
          ['Cari di dalam Settings', 'Ctrl + F'],
          ['Buka Halaman AI Chat (Free chat)', 'Ctrl + Shift + C'],
          ['Buka / Tutup In-App Reference Browser', 'Ctrl + Shift + B'],
          ['Sembunyikan / Tampilkan Sidebar Kiri', 'Ctrl + \\'],
          ['Ganti Mode Halaman (Block Doc ↔ Spatial Canvas)', 'Ctrl + Shift + M'],
          ['Quick Capture Global Window', 'Ctrl + Shift + Space'],
          ['Buka Daily Note Hari Ini', 'Ctrl + Shift + D'],
          ['Tutup Tab Aktif', 'Ctrl + W'],
          ['Buka Kembali Tab yang Baru Ditutup', 'Ctrl + Shift + T'],
          ['Pindah Antar Tab Terbuka', 'Ctrl + Tab'],
          ['Undo / Redo Perubahan Dokumen', 'Ctrl + Z / Ctrl + Shift + Z']
        ]
        return (
          <div className="space-y-6 animate-view-enter">
            <div>
              <h1 className="font-display text-xl font-bold text-ink-primary">
                Keyboard Shortcuts
              </h1>
              <p className="text-xs text-ink-secondary mt-1">
                Pintasan keyboard global dan lokal untuk navigasi cepat tanpa lepas dari papan ketik.
              </p>
            </div>

            <div className="rounded-xl bg-surface-elevated border border-border-hairline overflow-hidden divide-y divide-border-subtle">
              {shortcuts.map(([label, keys]) => (
                <div
                  key={label}
                  className="px-4 py-3 flex items-center justify-between text-xs hover:bg-surface-hover/40"
                >
                  <span className="text-ink-primary font-medium">{label}</span>
                  <kbd className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-chrome border border-border-hairline text-accent-cobalt">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )
      }

      case 'stats-usage': {
        return (
          <div className="space-y-6 animate-view-enter">
            <div>
              <h1 className="font-display text-xl font-bold text-ink-primary">
                Stats &amp; Workspace Telemetry
              </h1>
              <p className="text-xs text-ink-secondary mt-1">
                Metrik pemakaian ruang kerja lokal NoteIT secara real-time.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['NOTEBOOKS', notebooks.length],
                ['SECTIONS', sections.length],
                ['TOTAL PAGES', pages.length],
                ['TOTAL BLOCKS', totalBlocks],
                ['ESTIMATED WORDS', totalWords],
                ['INDEXED TAGS', tags.length]
              ].map(([label, val]) => (
                <div
                  key={String(label)}
                  className="p-4 rounded-xl bg-surface-elevated border border-border-hairline"
                >
                  <div className="font-mono text-[10px] text-ink-muted uppercase">{label}</div>
                  <div className="font-display text-2xl font-bold text-ink-primary mt-1 tabular-nums">
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }

      case 'browser': {
        return (
          <div className="space-y-6 animate-view-enter">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-ink-primary">
                In-App Reference Browser (Chromium &lt;webview&gt;)
              </h1>
              {renderBadge('Beta')}
            </div>
            <div className="p-6 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
              <p className="text-xs text-ink-secondary leading-relaxed">
                Modul Browser terintegrasi menggunakan mesin Chromium bawaan Electron dengan partisi sesi terisolasi (<code className="font-mono text-accent-cobalt">persist:noteit-browser</code>). Buka dokumentasi API eksternal, localhost dev server, atau referensi teknis, lalu gunakan <strong>Clip to Spec</strong> atau <strong>Ask AI</strong> untuk mengekstrak isi halaman langsung ke dokumen NoteIT.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMainView('browser')}
                  className="px-3.5 py-2 rounded-md bg-accent-cobalt hover:opacity-90 text-white text-xs font-medium flex items-center gap-2"
                >
                  <Globe size={13} />
                  <span>Buka In-App Browser (Ctrl+Shift+B)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMainView('workbench')
                    toggleBrowserSplitPane()
                  }}
                  className="px-3.5 py-2 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-2"
                >
                  <ExternalLink size={13} className="text-accent-amber" />
                  <span>Buka di Split-Pane Samping Editor</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      case 'mockup-studio': {
        return (
          <div className="space-y-6 animate-view-enter">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-ink-primary">
                UI Mockup &amp; Wireframe Studio
              </h1>
              {renderBadge('Beta')}
            </div>
            <div className="p-6 rounded-xl bg-surface-elevated border border-border-hairline space-y-3">
              <p className="text-xs text-ink-secondary leading-relaxed">
                Modul UI Mockup Studio dirancang untuk merancang wireframe antarmuka berdampingan dengan skema DBML dan diagram arsitektur (lihat blueprint lengkap di <code className="font-mono text-accent-cobalt">docs/ADE.md</code>).
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-surface-chrome border border-border-hairline font-mono text-[11px] text-accent-amber">
                <Sparkles size={13} />
                <span>Blueprint ADE Creative Workbench · Siap untuk iterasi selanjutnya</span>
              </div>
            </div>
          </div>
        )
      }

      default: {
        return (
          <div className="space-y-6 animate-view-enter">
            <div>
              <h1 className="font-display text-xl font-bold text-ink-primary capitalize">
                {activeSettingsSection.replace(/-/g, ' ')}
              </h1>
              <p className="text-xs text-ink-secondary mt-1">
                Pengaturan preferensi sistem, pemeliharaan workspace, dan perilaku editor NoteIT v2.0.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border-subtle">
                <div>
                  <div className="text-xs font-medium text-ink-primary">
                    Default Mode Halaman Baru
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Pilih apakah halaman baru langsung terbuka di Block Editor atau Spatial Canvas.
                  </div>
                </div>
                <select
                  value={preferences.defaultPageMode}
                  onChange={(e) =>
                    updatePreferences({
                      defaultPageMode: e.target.value === 'canvas' ? 'canvas' : 'block'
                    })
                  }
                  className="px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary"
                >
                  <option value="block">Block Document</option>
                  <option value="canvas">Spatial Canvas (24px Grid)</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border-subtle">
                <div>
                  <div className="text-xs font-medium text-ink-primary">
                    Pemeriksa Ejaan Editor (Spellcheck)
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Aktifkan garis bawah pemeriksaan ejaan di dalam blok teks.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updatePreferences({ spellcheck: !preferences.spellcheck })}
                  className={`px-3 py-1 rounded border text-xs font-mono ${
                    preferences.spellcheck
                      ? 'bg-accent-cobalt/15 border-accent-cobalt text-accent-cobalt'
                      : 'bg-surface-chrome border-border-hairline text-ink-secondary'
                  }`}
                >
                  {preferences.spellcheck ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-medium text-ink-primary">
                    Pembersihan Aset Yatim &amp; Dokumentasi HTML
                  </div>
                  <div className="text-[11px] text-ink-secondary">
                    Bersihkan lampiran yang tidak lagi dirujuk halaman mana pun atau buka panduan HTML statis.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGcAssets}
                    className="px-3 py-1.5 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary"
                  >
                    GC Orphan Assets
                  </button>
                  <button
                    type="button"
                    onClick={() => void openHelpCenter()}
                    className="px-3 py-1.5 rounded bg-accent-cobalt text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <HelpCircle size={13} />
                    <span>Buka Help HTML</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    }
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-canvas-primary ambient-aurora-host animate-view-enter">
      {/* Left Orca-Style Settings Navigation Rail */}
      <aside className="w-[264px] shrink-0 bg-surface-chrome border-r border-border-hairline flex flex-col h-full select-none">
        {/* Top: Back to app & Search settings (Ctrl+F) */}
        <div className="p-3 space-y-2.5 border-b border-border-hairline">
          <button
            type="button"
            onClick={() => setActiveMainView('workbench')}
            className="flex items-center gap-2 text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors px-1 py-0.5"
          >
            <ArrowLeft size={14} />
            <span>Back to app</span>
          </button>

          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings"
              className="w-full h-8 pl-8 pr-14 rounded-[6px] bg-surface-elevated border border-border-hairline text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-accent-cobalt"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none font-mono text-[10px] text-ink-muted">
              <kbd className="px-1 py-0.2 rounded bg-surface-chrome border border-border-hairline">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="px-1 py-0.2 rounded bg-surface-chrome border border-border-hairline">
                F
              </kbd>
            </div>
          </div>
        </div>

        {/* Scrollable Orca-style Categories + Projects */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {filteredGroups.map((group, idx) => (
            <div key={group.groupTitle || `grp-${idx}`} className="space-y-0.5">
              {group.groupTitle && (
                <div className="px-2 pb-1 font-mono text-[10px] tracking-wider uppercase text-ink-muted">
                  {group.groupTitle}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = activeSettingsSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSettingsSection(item.id)}
                    className={`w-full px-2.5 py-1.5 rounded-[6px] text-xs flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-surface-hover text-ink-primary font-medium'
                        : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className={isActive ? 'text-accent-cobalt' : 'text-ink-muted'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {renderBadge(item.badge)}
                  </button>
                )
              })}
            </div>
          ))}

          {/* Projects / Notebooks Section (Mirrors Orca's bottom Projects list) */}
          <div className="space-y-0.5 pt-2 border-t border-border-subtle">
            <div className="px-2 pb-1 font-mono text-[10px] tracking-wider uppercase text-ink-muted">
              Projects &amp; Notebooks
            </div>
            {notebooks.map((nb) => {
              const secKey = `notebook:${nb.id}`
              const isActive = activeSettingsSection === secKey
              return (
                <button
                  key={nb.id}
                  type="button"
                  onClick={() => setActiveSettingsSection(secKey)}
                  className={`w-full px-2.5 py-1.5 rounded-[6px] text-xs flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-surface-hover text-ink-primary font-medium'
                      : 'text-ink-secondary hover:bg-surface-hover/60 hover:text-ink-primary'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2 h-2 rounded-full ${MARKER_META[nb.color].bgStrip}`}
                    />
                    <span className="truncate">{nb.name}</span>
                  </span>
                  <span className="text-[11px] opacity-75">{nb.icon}</span>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Right Settings Content Host */}
      <div className="flex-1 overflow-y-auto px-8 py-7">
        <div className="max-w-4xl mx-auto">{renderActivePanel()}</div>
      </div>
    </div>
  )
}
