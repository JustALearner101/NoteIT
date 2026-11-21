import type { MarkerColor } from '@shared/types/domain'

export const MARKER_META: Record<
  MarkerColor,
  {
    label: string
    hex: string
    bgStrip: string
    border: string
    badgeBg: string
    text: string
    dotBg: string
  }
> = {
  cobalt: {
    label: 'Periwinkle Indigo',
    hex: '#6E7BF2',
    bgStrip: 'bg-[#6E7BF2]',
    border: 'border-[#6E7BF2]/50',
    badgeBg:
      'bg-[var(--pill-cobalt-bg)] text-[var(--pill-cobalt-text)] border-[var(--pill-cobalt-border)]',
    text: 'text-[var(--pill-cobalt-text)]',
    dotBg: 'bg-[#6E7BF2]'
  },
  amber: {
    label: 'Warm Amber',
    hex: '#E5A93C',
    bgStrip: 'bg-[#E5A93C]',
    border: 'border-[#E5A93C]/50',
    badgeBg:
      'bg-[var(--pill-amber-bg)] text-[var(--pill-amber-text)] border-[var(--pill-amber-border)]',
    text: 'text-[var(--pill-amber-text)]',
    dotBg: 'bg-[#E5A93C]'
  },
  teal: {
    label: 'Mint Emerald',
    hex: '#2DD4BF',
    bgStrip: 'bg-[#2DD4BF]',
    border: 'border-[#2DD4BF]/50',
    badgeBg:
      'bg-[var(--pill-teal-bg)] text-[var(--pill-teal-text)] border-[var(--pill-teal-border)]',
    text: 'text-[var(--pill-teal-text)]',
    dotBg: 'bg-[#2DD4BF]'
  },
  red: {
    label: 'Soft Rose',
    hex: '#F87171',
    bgStrip: 'bg-[#F87171]',
    border: 'border-[#F87171]/50',
    badgeBg:
      'bg-[var(--pill-red-bg)] text-[var(--pill-red-text)] border-[var(--pill-red-border)]',
    text: 'text-[var(--pill-red-text)]',
    dotBg: 'bg-[#F87171]'
  },
  violet: {
    label: 'Soft Iris',
    hex: '#A78BFA',
    bgStrip: 'bg-[#A78BFA]',
    border: 'border-[#A78BFA]/50',
    badgeBg:
      'bg-[var(--pill-violet-bg)] text-[var(--pill-violet-text)] border-[var(--pill-violet-border)]',
    text: 'text-[var(--pill-violet-text)]',
    dotBg: 'bg-[#A78BFA]'
  },
  slate: {
    label: 'Neutral Zinc',
    hex: '#787886',
    bgStrip: 'bg-[#787886]',
    border: 'border-[#787886]/50',
    badgeBg:
      'bg-[var(--pill-slate-bg)] text-[var(--pill-slate-text)] border-[var(--pill-slate-border)]',
    text: 'text-[var(--pill-slate-text)]',
    dotBg: 'bg-[#787886]'
  }
}

export const MARKER_COLORS: MarkerColor[] = ['cobalt', 'amber', 'teal', 'red', 'violet', 'slate']
