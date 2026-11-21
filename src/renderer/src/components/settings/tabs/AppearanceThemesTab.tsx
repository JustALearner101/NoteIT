import React, { useMemo, useState } from 'react'
import { Check, Download, Eye, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { useWorkspaceStore } from '@renderer/stores/useWorkspaceStore'
import {
  applyThemeToDocument,
  BUILTIN_THEMES,
  type MotionLevel,
  type ThemeColors,
  type ThemeDefinition
} from '@renderer/lib/themes'
import { Button, cn } from '@renderer/components/ui'

const COLOR_TOKENS = [
  ['bgCanvasPrimary', 'Canvas background'],
  ['bgSurfaceChrome', 'Sidebar / chrome'],
  ['bgSurfaceElevated', 'Elevated card'],
  ['borderHairline', 'Hairline border'],
  ['textPrimary', 'Primary ink'],
  ['textSecondary', 'Secondary ink'],
  ['accentCobalt', 'Primary accent'],
  ['accentAmber', 'Secondary accent']
] as const

const labelCls = 'block font-mono text-[10px] uppercase text-ink-muted mb-1'
const fieldCls =
  'w-full px-2.5 py-1.5 rounded bg-surface-chrome border border-border-hairline text-xs text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-cobalt'
const smallBtn =
  'px-2.5 py-1.5 rounded-md bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs text-ink-primary flex items-center gap-1.5'

export const AppearanceThemesTab: React.FC = () => {
  const { preferences, setActiveTheme, saveCustomTheme, deleteCustomTheme, updatePreferences, showToast } =
    useWorkspaceStore()

  const allThemes = useMemo(
    () => [...BUILTIN_THEMES, ...preferences.customThemes],
    [preferences.customThemes]
  )
  const activeThemeObj = allThemes.find((t) => t.id === preferences.activeThemeId) || BUILTIN_THEMES[0]

  const [customName, setCustomName] = useState('My custom studio')
  const [customScheme, setCustomScheme] = useState<'dark' | 'light'>('dark')
  const [customGlow, setCustomGlow] = useState(true)
  const [customColors, setCustomColors] = useState<ThemeColors>(activeThemeObj.colors)
  const [importJsonText, setImportJsonText] = useState('')
  const [isImportingJson, setIsImportingJson] = useState(false)

  const loadThemeIntoBuilder = (theme: ThemeDefinition): void => {
    setCustomName(`${theme.name} custom`)
    setCustomScheme(theme.colorScheme)
    setCustomGlow(theme.ambientGlow)
    setCustomColors({ ...theme.colors })
    showToast(`Palette '${theme.name}' loaded into Custom Theme Studio`)
  }

  const previewTheme = (): void => {
    applyThemeToDocument(
      {
        id: 'preview-custom',
        name: customName || 'Preview theme',
        tagline: 'Live preview',
        colorScheme: customScheme,
        ambientGlow: customGlow,
        isCustom: true,
        colors: customColors
      },
      preferences.motionLevel,
      preferences.fontScale
    )
    showToast('Showing live preview of the custom theme')
  }

  const saveTheme = (): void => {
    const slug =
      'custom-' + (customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || Date.now().toString())
    saveCustomTheme({
      id: slug,
      name: customName.trim() || 'Custom theme',
      tagline: 'User-made custom theme',
      badge: 'Custom',
      colorScheme: customScheme,
      ambientGlow: customGlow,
      isCustom: true,
      colors: customColors
    })
  }

  const exportJson = (): void => {
    const payload = JSON.stringify(
      { name: customName, colorScheme: customScheme, ambientGlow: customGlow, colors: customColors },
      null,
      2
    )
    navigator.clipboard?.writeText(payload)
    showToast('Theme JSON copied to clipboard')
  }

  const importJson = (): void => {
    try {
      const parsed = JSON.parse(importJsonText)
      if (!parsed || typeof parsed !== 'object' || !parsed.colors) {
        showToast('Invalid theme JSON format')
        return
      }
      saveCustomTheme({
        id: 'custom-' + Date.now(),
        name: parsed.name || 'Imported theme',
        tagline: 'Imported from JSON',
        badge: 'Imported',
        colorScheme: parsed.colorScheme === 'light' ? 'light' : 'dark',
        ambientGlow: Boolean(parsed.ambientGlow),
        isCustom: true,
        colors: { ...activeThemeObj.colors, ...parsed.colors }
      })
      setImportJsonText('')
      setIsImportingJson(false)
    } catch {
      showToast('Failed to parse theme JSON')
    }
  }

  return (
    <div className="space-y-8 animate-view-enter">
      <div>
        <h1 className="font-display text-xl font-bold tracking-[-0.02em] text-ink-primary">
          Appearance &amp; theme studio
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          Pick a curated preset (Obsidian Studio, Graphite Slate, Orca Carbon, Archival Vellum, and more)
          or craft your own theme.
        </p>
      </div>

      <section aria-labelledby="theme-presets-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="theme-presets-heading" className="font-display text-sm font-semibold text-ink-primary">
            Theme presets ({allThemes.length})
          </h2>
          <span className="text-xs text-ink-muted">
            Active: <strong className="text-accent-cobalt font-medium">{activeThemeObj.name}</strong>
          </span>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allThemes.map((t) => {
            const isSelected = t.id === preferences.activeThemeId
            return (
              <li
                key={t.id}
                className={cn(
                  'rounded-[12px] border transition-all flex flex-col',
                  isSelected
                    ? 'border-[var(--node-selected-border)] shadow-node-selected bg-[var(--node-selected-bg)]'
                    : 'border-border-hairline bg-surface-elevated hover:border-border-strong'
                )}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Use theme ${t.name}`}
                  onClick={() => setActiveTheme(t.id)}
                  className="text-left p-3 pb-2 flex-1"
                >
                  <div
                    className="h-20 rounded-md border overflow-hidden mb-2.5 flex flex-col justify-between p-2"
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
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.accentCobalt }} />
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.accentAmber }} />
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
                      <span className="font-mono text-[10px] truncate" style={{ color: t.colors.textPrimary }}>
                        Aa · {t.colorScheme.toUpperCase()}
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: t.colors.textSecondary }}>
                        {t.colors.accentCobalt}
                      </span>
                    </div>
                  </div>
                  <span className="font-display font-semibold text-xs text-ink-primary flex items-center gap-1.5">
                    {t.name}
                    {isSelected && <Check size={13} className="text-accent-cobalt" aria-hidden="true" />}
                  </span>
                  <p className="text-[11px] text-ink-secondary mt-1 line-clamp-2">{t.tagline}</p>
                </button>
                <div className="px-3 pb-3 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadThemeIntoBuilder(t)}
                    aria-label={`Clone ${t.name} into Custom Theme Studio`}
                    title="Copy colors into Custom Theme Studio"
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-chrome hover:bg-surface-hover text-ink-secondary hover:text-ink-primary border border-border-hairline"
                  >
                    Clone
                  </button>
                  {t.isCustom && (
                    <button
                      type="button"
                      onClick={() => deleteCustomTheme(t.id)}
                      aria-label={`Delete custom theme ${t.name}`}
                      title="Delete custom theme"
                      className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-accent-rose"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section
        aria-labelledby="custom-theme-heading"
        className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="custom-theme-heading"
              className="font-display text-sm font-semibold text-ink-primary flex items-center gap-2"
            >
              <Sparkles size={15} className="text-accent-cobalt" aria-hidden="true" />
              <span>Custom theme studio</span>
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Tune every color token, toggle the aurora glow, and save it as a personal preset.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportJson} className={smallBtn}>
              <Download size={12} aria-hidden="true" />
              <span>Copy JSON</span>
            </button>
            <button
              type="button"
              aria-expanded={isImportingJson}
              onClick={() => setIsImportingJson(!isImportingJson)}
              className={smallBtn}
            >
              <Upload size={12} aria-hidden="true" />
              <span>Import JSON</span>
            </button>
          </div>
        </div>

        {isImportingJson && (
          <div className="p-3 rounded-lg bg-surface-chrome border border-border-hairline space-y-2">
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              rows={4}
              aria-label="Theme JSON to import"
              placeholder='Paste theme JSON here (e.g. {"name": "Cyber", "colors": {...}})...'
              className="w-full p-2 rounded bg-surface-elevated border border-border-hairline font-mono text-xs text-ink-primary focus:outline-none focus:border-accent-cobalt"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportingJson(false)}
                className="px-2.5 py-1 rounded text-xs text-ink-secondary hover:text-ink-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={importJson}
                className="px-3 py-1 rounded bg-accent-cobalt text-white text-xs font-medium"
              >
                Apply JSON
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="custom-theme-name" className={labelCls}>
              Custom theme name
            </label>
            <input
              id="custom-theme-name"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label htmlFor="custom-theme-scheme" className={labelCls}>
              Base color scheme
            </label>
            <select
              id="custom-theme-scheme"
              value={customScheme}
              onChange={(e) => setCustomScheme(e.target.value === 'light' ? 'light' : 'dark')}
              className={fieldCls}
            >
              <option value="dark">Dark scheme</option>
              <option value="light">Light scheme</option>
            </select>
          </div>
          <div>
            <span id="custom-glow-label" className={labelCls}>
              Ambient aurora glow
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={customGlow}
              aria-labelledby="custom-glow-label"
              onClick={() => setCustomGlow(!customGlow)}
              className={cn(
                'w-full px-2.5 py-1.5 rounded border text-xs font-medium flex items-center justify-between',
                customGlow
                  ? 'bg-accent-cobalt/15 border-accent-cobalt text-accent-cobalt'
                  : 'bg-surface-chrome border-border-hairline text-ink-secondary'
              )}
            >
              <span>{customGlow ? 'On (Finns Nebula style)' : 'Off (matte)'}</span>
              <span>{customGlow ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {COLOR_TOKENS.map(([key, label]) => (
            <div
              key={key}
              className="p-2 rounded-lg bg-surface-chrome border border-border-hairline flex items-center gap-2.5"
            >
              <input
                type="color"
                aria-label={`${label} color picker`}
                value={customColors[key]}
                onChange={(e) => setCustomColors((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-ink-primary truncate">{label}</div>
                <input
                  type="text"
                  aria-label={`${label} hex value`}
                  value={customColors[key]}
                  onChange={(e) => setCustomColors((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full bg-transparent font-mono text-[10px] text-ink-secondary focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button variant="secondary" size="sm" onClick={previewTheme}>
            <Eye size={13} aria-hidden="true" />
            <span>Live preview</span>
          </Button>
          <Button variant="primary" size="sm" onClick={saveTheme}>
            <Plus size={13} aria-hidden="true" />
            <span>Save &amp; use theme</span>
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="comfort-heading"
        className="p-5 rounded-xl bg-surface-elevated border border-border-hairline space-y-4"
      >
        <div>
          <h2 id="comfort-heading" className="font-display text-sm font-semibold text-ink-primary">
            Motion &amp; visual comfort
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Adjust transition intensity, typography size, and canvas grid visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="motion-level" className={labelCls}>
              Motion intensity
            </label>
            <select
              id="motion-level"
              value={preferences.motionLevel}
              onChange={(e) => updatePreferences({ motionLevel: e.target.value as MotionLevel })}
              className={fieldCls}
            >
              <option value="full">Full motion (precise &amp; snappy)</option>
              <option value="subtle">Subtle (fast transitions)</option>
              <option value="off">Off / instant (no animation)</option>
            </select>
          </div>
          <div>
            <label htmlFor="font-scale" className={labelCls}>
              Text size
            </label>
            <select
              id="font-scale"
              value={preferences.fontScale}
              onChange={(e) =>
                updatePreferences({ fontScale: e.target.value as 'compact' | 'default' | 'comfortable' })
              }
              className={fieldCls}
            >
              <option value="compact">Compact (15px)</option>
              <option value="default">Default (16px)</option>
              <option value="comfortable">Comfortable (17px)</option>
            </select>
          </div>
          <div>
            <span id="grid-label" className={labelCls}>
              24px blueprint grid
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.showBlueprintGrid}
              aria-labelledby="grid-label"
              onClick={() => updatePreferences({ showBlueprintGrid: !preferences.showBlueprintGrid })}
              className={cn(
                'w-full px-2.5 py-1.5 rounded border text-xs font-medium flex items-center justify-between',
                preferences.showBlueprintGrid
                  ? 'bg-accent-cobalt/15 border-accent-cobalt text-accent-cobalt'
                  : 'bg-surface-chrome border-border-hairline text-ink-secondary'
              )}
            >
              <span>{preferences.showBlueprintGrid ? 'Shown' : 'Hidden'}</span>
              <span>{preferences.showBlueprintGrid ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
