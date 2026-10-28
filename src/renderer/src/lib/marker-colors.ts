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
  }
> = {
  cobalt: {
    label: 'Blueprint Cobalt',
    hex: '#3B82F6',
    bgStrip: 'bg-[#3B82F6]',
    border: 'border-[#3B82F6]',
    badgeBg: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30',
    text: 'text-[#3B82F6]'
  },
  amber: {
    label: 'Caliper Amber',
    hex: '#F59E0B',
    bgStrip: 'bg-[#F59E0B]',
    border: 'border-[#F59E0B]',
    badgeBg: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
    text: 'text-[#F59E0B]'
  },
  teal: {
    label: 'Verdigris Teal',
    hex: '#10B981',
    bgStrip: 'bg-[#10B981]',
    border: 'border-[#10B981]',
    badgeBg: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
    text: 'text-[#10B981]'
  },
  red: {
    label: 'Vermilion Red',
    hex: '#EF4444',
    bgStrip: 'bg-[#EF4444]',
    border: 'border-[#EF4444]',
    badgeBg: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
    text: 'text-[#EF4444]'
  },
  violet: {
    label: 'Oxide Violet',
    hex: '#8B5CF6',
    bgStrip: 'bg-[#8B5CF6]',
    border: 'border-[#8B5CF6]',
    badgeBg: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30',
    text: 'text-[#8B5CF6]'
  },
  slate: {
    label: 'Slate Ochre',
    hex: '#64748B',
    bgStrip: 'bg-[#64748B]',
    border: 'border-[#64748B]',
    badgeBg: 'bg-[#64748B]/15 text-[#94A3B8] border-[#64748B]/30',
    text: 'text-[#94A3B8]'
  }
}

export const MARKER_COLORS: MarkerColor[] = ['cobalt', 'amber', 'teal', 'red', 'violet', 'slate']
