export interface ThemeColors {
  bgCanvasPrimary: string
  bgSurfaceChrome: string
  bgSurfaceElevated: string
  bgSurfaceHover: string
  borderHairline: string
  borderSubtle: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accentCobalt: string
  accentAmber: string
  glowPrimary?: string
  glowSecondary?: string
}

export interface ThemeDefinition {
  id: string
  name: string
  tagline: string
  badge?: string
  colorScheme: 'dark' | 'light'
  ambientGlow: boolean
  isCustom?: boolean
  colors: ThemeColors
}

export type MotionLevel = 'full' | 'subtle' | 'off'

export interface WorkbenchPreferences {
  activeThemeId: string
  customThemes: ThemeDefinition[]
  motionLevel: MotionLevel
  fontScale: 'compact' | 'default' | 'comfortable'
  showBlueprintGrid: boolean
  autoSaveDelayMs: number
  spellcheck: boolean
  defaultPageMode: 'block' | 'canvas'
  aiProvider: 'gemini' | 'openai' | 'anthropic' | 'ollama'
  aiModel: string
  aiApprovalMode: 'ask' | 'auto-edit' | 'plan-only'
  aiApiKeyMasked: string
  onboardingDone: string[]
}

export const PREFERENCES_STORAGE_KEY = 'noteit:preferences:v2'

export const BUILTIN_THEMES: ThemeDefinition[] = [
  {
    id: 'obsidian-studio',
    name: 'Obsidian Studio',
    tagline: 'Matte obsidian netral yang tenang dengan aksen Periwinkle Indigo & pill pastel lembut',
    badge: 'Default',
    colorScheme: 'dark',
    ambientGlow: false,
    colors: {
      bgCanvasPrimary: '#141417',
      bgSurfaceChrome: '#0E0E11',
      bgSurfaceElevated: '#1C1C21',
      bgSurfaceHover: '#24242B',
      borderHairline: '#27272E',
      borderSubtle: '#1F1F25',
      textPrimary: '#EDEDEF',
      textSecondary: '#9A9AA6',
      textMuted: '#787886',
      accentCobalt: '#6E7BF2',
      accentAmber: '#E5A93C',
      glowPrimary: 'rgba(110, 123, 242, 0.14)',
      glowSecondary: 'rgba(45, 212, 191, 0.10)'
    }
  },
  {
    id: 'graphite-slate',
    name: 'Graphite Slate',
    tagline: 'Standar rekayasa presisi klasik dengan aksen Cobalt & Amber',
    badge: 'Classic',
    colorScheme: 'dark',
    ambientGlow: false,
    colors: {
      bgCanvasPrimary: '#111317',
      bgSurfaceChrome: '#0C0E12',
      bgSurfaceElevated: '#181B22',
      bgSurfaceHover: '#20242D',
      borderHairline: '#262A34',
      borderSubtle: '#1C2029',
      textPrimary: '#ECEEF2',
      textSecondary: '#949BA6',
      textMuted: '#727988',
      accentCobalt: '#3B82F6',
      accentAmber: '#F59E0B',
      glowPrimary: 'rgba(59, 130, 246, 0.14)',
      glowSecondary: 'rgba(245, 158, 11, 0.10)'
    }
  },
  {
    id: 'orca-carbon',
    name: 'Orca Carbon',
    tagline: 'Matte carbon ultra-tenang terinspirasi workspace AI modern',
    badge: 'Ref #1',
    colorScheme: 'dark',
    ambientGlow: false,
    colors: {
      bgCanvasPrimary: '#0E0E10',
      bgSurfaceChrome: '#141416',
      bgSurfaceElevated: '#1C1C1F',
      bgSurfaceHover: '#242429',
      borderHairline: '#27272B',
      borderSubtle: '#1E1E22',
      textPrimary: '#F4F4F6',
      textSecondary: '#A1A1AA',
      textMuted: '#767680',
      accentCobalt: '#F97316',
      accentAmber: '#38BDF8',
      glowPrimary: 'rgba(249, 115, 22, 0.12)',
      glowSecondary: 'rgba(56, 189, 248, 0.08)'
    }
  },
  {
    id: 'codezone-amber',
    name: 'Code.Zone Amber',
    tagline: 'True OLED pitch black dengan aksen terminal Amber menyala',
    badge: 'Ref #2',
    colorScheme: 'dark',
    ambientGlow: true,
    colors: {
      bgCanvasPrimary: '#050507',
      bgSurfaceChrome: '#0A0B0E',
      bgSurfaceElevated: '#121318',
      bgSurfaceHover: '#1A1C24',
      borderHairline: '#232631',
      borderSubtle: '#161820',
      textPrimary: '#F3F4F6',
      textSecondary: '#9CA3AF',
      textMuted: '#6E7687',
      accentCobalt: '#F59E0B',
      accentAmber: '#FB923C',
      glowPrimary: 'rgba(245, 158, 11, 0.15)',
      glowSecondary: 'rgba(251, 146, 60, 0.10)'
    }
  },
  {
    id: 'finns-nebula',
    name: 'Finns Cosmic Nebula',
    tagline: 'Deep space indigo dengan pendaran Aurora Violet & Sapphire',
    badge: 'Ref #3 · Glow',
    colorScheme: 'dark',
    ambientGlow: true,
    colors: {
      bgCanvasPrimary: '#070514',
      bgSurfaceChrome: '#0C0822',
      bgSurfaceElevated: '#140E32',
      bgSurfaceHover: '#1E1646',
      borderHairline: '#2E2363',
      borderSubtle: '#1B133D',
      textPrimary: '#F5F3FF',
      textSecondary: '#B6AEE0',
      textMuted: '#8378B5',
      accentCobalt: '#A855F7',
      accentAmber: '#3B82F6',
      glowPrimary: 'rgba(168, 85, 247, 0.24)',
      glowSecondary: 'rgba(59, 130, 246, 0.22)'
    }
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    tagline: 'Indigo malam Tokyo dengan aksen Cyber Cyan & Magenta',
    colorScheme: 'dark',
    ambientGlow: true,
    colors: {
      bgCanvasPrimary: '#1A1B26',
      bgSurfaceChrome: '#16161E',
      bgSurfaceElevated: '#24283B',
      bgSurfaceHover: '#2F3549',
      borderHairline: '#3B4261',
      borderSubtle: '#292E42',
      textPrimary: '#C0CAF5',
      textSecondary: '#9AA5CE',
      textMuted: '#6F79A6',
      accentCobalt: '#7AA2F7',
      accentAmber: '#BB9AF7',
      glowPrimary: 'rgba(122, 162, 247, 0.14)',
      glowSecondary: 'rgba(187, 154, 247, 0.12)'
    }
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    tagline: 'Palet pastel hangat dengan aksen Lavender & Peach',
    colorScheme: 'dark',
    ambientGlow: false,
    colors: {
      bgCanvasPrimary: '#1E1E2E',
      bgSurfaceChrome: '#181825',
      bgSurfaceElevated: '#313244',
      bgSurfaceHover: '#45475A',
      borderHairline: '#45475A',
      borderSubtle: '#313244',
      textPrimary: '#CDD6F4',
      textSecondary: '#BAC2DE',
      textMuted: '#7F849C',
      accentCobalt: '#B4BEFE',
      accentAmber: '#FAB387',
      glowPrimary: 'rgba(180, 190, 254, 0.14)',
      glowSecondary: 'rgba(250, 179, 135, 0.10)'
    }
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    tagline: 'Biru kutub arktik dengan aksen Frost Cyan & Aurora Gold',
    colorScheme: 'dark',
    ambientGlow: false,
    colors: {
      bgCanvasPrimary: '#2E3440',
      bgSurfaceChrome: '#242933',
      bgSurfaceElevated: '#3B4252',
      bgSurfaceHover: '#434C5E',
      borderHairline: '#4C566A',
      borderSubtle: '#3B4252',
      textPrimary: '#ECEFF4',
      textSecondary: '#D8DEE9',
      textMuted: '#8FA8C6',
      accentCobalt: '#88C0D0',
      accentAmber: '#EBCB8B',
      glowPrimary: 'rgba(136, 192, 208, 0.14)',
      glowSecondary: 'rgba(235, 203, 139, 0.10)'
    }
  },
  {
    id: 'archival-vellum',
    name: 'Archival Vellum',
    tagline: 'Permukaan terang bersih & netral dengan aksen Indigo halus',
    badge: 'Light',
    colorScheme: 'light',
    ambientGlow: false,
    colors: {
      bgCanvasPrimary: '#F8F8FA',
      bgSurfaceChrome: '#F1F1F5',
      bgSurfaceElevated: '#FFFFFF',
      bgSurfaceHover: '#E7E7EE',
      borderHairline: '#E0E0E8',
      borderSubtle: '#ECECF2',
      textPrimary: '#141418',
      textSecondary: '#525260',
      textMuted: '#767686',
      accentCobalt: '#5B67E8',
      accentAmber: '#C98212',
      glowPrimary: 'rgba(91, 103, 232, 0.08)',
      glowSecondary: 'rgba(16, 185, 129, 0.06)'
    }
  },
  {
    id: 'solarized-paper',
    name: 'Solarized Studio',
    tagline: 'Kertas perkamen klasik dengan kontras mata rendah',
    badge: 'Light',
    colorScheme: 'light',
    ambientGlow: false,
    colors: {
      bgCanvasPrimary: '#FDF6E3',
      bgSurfaceChrome: '#EEE8D5',
      bgSurfaceElevated: '#FFFDF7',
      bgSurfaceHover: '#E4DEC8',
      borderHairline: '#D3CBB7',
      borderSubtle: '#E6DFCA',
      textPrimary: '#073642',
      textSecondary: '#586E75',
      textMuted: '#839496',
      accentCobalt: '#268BD2',
      accentAmber: '#CB4B16',
      glowPrimary: 'rgba(38, 139, 210, 0.08)',
      glowSecondary: 'rgba(203, 75, 22, 0.06)'
    }
  }
]

export const DEFAULT_PREFERENCES: WorkbenchPreferences = {
  activeThemeId: 'obsidian-studio',
  customThemes: [],
  motionLevel: 'full',
  fontScale: 'default',
  showBlueprintGrid: true,
  autoSaveDelayMs: 350,
  spellcheck: false,
  defaultPageMode: 'block',
  aiProvider: 'gemini',
  aiModel: 'Default (recommended) · High',
  aiApprovalMode: 'ask',
  aiApiKeyMasked: '',
  onboardingDone: ['create-notebook', 'block-editor']
}

export function loadPreferences(): WorkbenchPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<WorkbenchPreferences>
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      customThemes: Array.isArray(parsed.customThemes) ? parsed.customThemes : [],
      onboardingDone: Array.isArray(parsed.onboardingDone)
        ? parsed.onboardingDone
        : DEFAULT_PREFERENCES.onboardingDone
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(prefs: WorkbenchPreferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Abaikan bila localStorage tidak bisa diakses di lingkungan terbatas
  }
}

export function resolveThemeById(
  themeId: string,
  customThemes: ThemeDefinition[] = []
): ThemeDefinition {
  const all = [...BUILTIN_THEMES, ...customThemes]
  return all.find((t) => t.id === themeId) || BUILTIN_THEMES[0]
}

export function applyThemeToDocument(
  theme: ThemeDefinition,
  motionLevel: MotionLevel = 'full',
  fontScale: WorkbenchPreferences['fontScale'] = 'default'
): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  if (theme.colorScheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  root.style.colorScheme = theme.colorScheme
  root.setAttribute('data-theme-id', theme.id)
  root.setAttribute('data-ambient-glow', theme.ambientGlow ? 'true' : 'false')
  root.setAttribute('data-motion', motionLevel)
  root.setAttribute('data-font-scale', fontScale)

  const { colors } = theme
  root.style.setProperty('--bg-canvas-primary', colors.bgCanvasPrimary)
  root.style.setProperty('--bg-surface-chrome', colors.bgSurfaceChrome)
  root.style.setProperty('--bg-surface-recessed', colors.bgSurfaceChrome)
  root.style.setProperty('--bg-surface-elevated', colors.bgSurfaceElevated)
  root.style.setProperty('--bg-surface-hover', colors.bgSurfaceHover)
  root.style.setProperty('--border-hairline', colors.borderHairline)
  root.style.setProperty('--border-subtle', colors.borderSubtle)
  root.style.setProperty('--text-primary', colors.textPrimary)
  root.style.setProperty('--text-secondary', colors.textSecondary)
  root.style.setProperty('--text-muted', colors.textMuted)
  root.style.setProperty('--accent-cobalt', colors.accentCobalt)
  root.style.setProperty('--accent-amber', colors.accentAmber)
  root.style.setProperty(
    '--glow-primary',
    colors.glowPrimary || 'rgba(110, 123, 242, 0.14)'
  )
  root.style.setProperty(
    '--glow-secondary',
    colors.glowSecondary || 'rgba(45, 212, 191, 0.10)'
  )

  const gridDot =
    theme.colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.085)' : 'rgba(20, 20, 28, 0.13)'
  root.style.setProperty('--grid-dot', gridDot)
}
