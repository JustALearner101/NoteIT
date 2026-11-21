import React from 'react'
import { Download, ExternalLink, FileText, Paperclip } from 'lucide-react'
import { assetUrl, formatAssetSize, isImageMime, isPdfMime } from '@shared/assets'
import type { DocumentBlock } from '@shared/types/domain'

interface AssetBlockProps {
  block: DocumentBlock
}

/**
 * Blok aset: gambar via <img>, PDF via <iframe> (Range didukung protocol handler),
 * selain itu kartu berkas dengan tombol buka eksternal dan simpan sebagai.
 * Semua src memakai skema noteit-asset:// — tidak ada path filesystem di renderer.
 */
export const AssetBlock: React.FC<AssetBlockProps> = ({ block }) => {
  const { assetId, assetExt, assetMime, assetName, assetSize } = block
  const name = assetName || block.content || 'Asset'
  const sizeLabel = typeof assetSize === 'number' ? formatAssetSize(assetSize) : ''
  const mime = assetMime || ''

  const openExternal = (): void => {
    if (assetId) void window.noteitAPI.openAssetExternal(assetId)
  }

  const saveAs = (): void => {
    if (assetId) void window.noteitAPI.saveAssetAs({ assetId, name, ext: assetExt || 'bin' })
  }

  if (!assetId || !assetExt) {
    return (
      <div className="rounded-[10px] border border-dashed border-border-hairline bg-surface-elevated px-4 py-4 text-xs text-ink-muted flex items-center gap-2">
        <Paperclip size={13} aria-hidden="true" /> Asset is not linked to any file yet.
      </div>
    )
  }

  const src = assetUrl(assetId, assetExt)

  const actions = (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={saveAs}
        title="Save as file..."
        aria-label={`Save ${name} as file`}
        className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
      >
        <Download size={12} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={openExternal}
        title="Open in external application"
        aria-label={`Open ${name} externally`}
        className="p-1 rounded-[6px] hover:bg-surface-hover text-ink-secondary hover:text-ink-primary transition-colors"
      >
        <ExternalLink size={12} aria-hidden="true" />
      </button>
    </span>
  )

  if (isImageMime(mime)) {
    return (
      <figure className="rounded-[12px] border border-border-hairline bg-surface-chrome overflow-hidden shadow-card">
        <img
          src={src}
          alt={name}
          draggable={false}
          className="block mx-auto max-h-[560px] max-w-full w-auto select-none"
        />
        <figcaption className="flex items-center justify-between gap-3 px-3.5 py-2 border-t border-border-hairline text-[11.5px] text-ink-muted">
          <span className="truncate">
            {name}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </span>
          {actions}
        </figcaption>
      </figure>
    )
  }

  if (isPdfMime(mime)) {
    return (
      <div className="rounded-[12px] border border-border-hairline bg-surface-chrome overflow-hidden shadow-card">
        <div className="px-3.5 py-2 bg-surface-elevated border-b border-border-hairline flex items-center justify-between gap-3 text-[11.5px] text-ink-secondary">
          <span className="truncate font-medium">
            PDF · {name}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </span>
          {actions}
        </div>
        <iframe src={src} title={name} className="w-full h-[70vh] bg-canvas-primary" />
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-border-hairline bg-surface-elevated px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className="w-9 h-9 rounded-[8px] bg-surface-chrome border border-border-hairline flex items-center justify-center shrink-0">
        <FileText size={16} className="text-accent-amber" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink-primary truncate">{name}</div>
        <div className="font-mono text-[10.5px] text-ink-muted uppercase">
          {assetExt}
          {sizeLabel ? ` · ${sizeLabel}` : ''}
          {mime ? ` · ${mime}` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={openExternal}
        className="h-7 px-2.5 rounded-[7px] bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
      >
        <ExternalLink size={11.5} aria-hidden="true" /> Open
      </button>
      <button
        type="button"
        onClick={saveAs}
        className="h-7 px-2.5 rounded-[7px] bg-surface-chrome hover:bg-surface-hover border border-border-hairline text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 transition-colors"
      >
        <Download size={11.5} aria-hidden="true" /> Save
      </button>
    </div>
  )
}
