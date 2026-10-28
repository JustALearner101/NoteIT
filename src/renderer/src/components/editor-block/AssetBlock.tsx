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
  const name = assetName || block.content || 'Aset'
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
      <div className="rounded-[6px] border border-dashed border-border-hairline bg-surface-elevated px-3 py-4 font-mono text-[11px] text-ink-muted flex items-center gap-2">
        <Paperclip size={12} /> Aset belum terhubung ke berkas mana pun.
      </div>
    )
  }

  const src = assetUrl(assetId, assetExt)

  const actions = (
    <span className="flex items-center gap-1.5">
      <button
        onClick={saveAs}
        title="Simpan sebagai berkas..."
        className="p-1 rounded hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt"
      >
        <Download size={11} />
      </button>
      <button
        onClick={openExternal}
        title="Buka di aplikasi eksternal"
        className="p-1 rounded hover:bg-surface-hover text-ink-secondary hover:text-accent-cobalt"
      >
        <ExternalLink size={11} />
      </button>
    </span>
  )

  if (isImageMime(mime)) {
    return (
      <figure className="rounded-[6px] border border-border-hairline bg-surface-chrome overflow-hidden">
        <img
          src={src}
          alt={name}
          draggable={false}
          className="block mx-auto max-h-[560px] max-w-full w-auto select-none"
        />
        <figcaption className="flex items-center justify-between gap-3 px-3 py-1.5 border-t border-border-hairline font-mono text-[10px] text-ink-muted">
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
      <div className="rounded-[6px] border border-border-hairline bg-surface-chrome overflow-hidden">
        <div className="px-3 py-1.5 bg-surface-elevated border-b border-border-hairline flex items-center justify-between gap-3 font-mono text-[10px] text-ink-muted">
          <span className="truncate uppercase">
            PDF · {name}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </span>
          {actions}
        </div>
        <iframe src={src} title={name} className="w-full h-[70vh] bg-surface-base" />
      </div>
    )
  }

  return (
    <div className="rounded-[6px] border border-border-hairline bg-surface-elevated px-3.5 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded bg-surface-chrome border border-border-hairline flex items-center justify-center shrink-0">
        <FileText size={16} className="text-accent-amber" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink-primary truncate">{name}</div>
        <div className="font-mono text-[10px] text-ink-muted uppercase">
          {assetExt}
          {sizeLabel ? ` · ${sizeLabel}` : ''}
          {mime ? ` · ${mime}` : ''}
        </div>
      </div>
      <button
        onClick={openExternal}
        className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline font-mono text-[10px] text-ink-secondary hover:text-accent-cobalt flex items-center gap-1"
      >
        <ExternalLink size={11} /> Buka
      </button>
      <button
        onClick={saveAs}
        className="px-2.5 py-1 rounded bg-surface-chrome hover:bg-surface-hover border border-border-hairline font-mono text-[10px] text-ink-secondary hover:text-accent-cobalt flex items-center gap-1"
      >
        <Download size={11} /> Simpan
      </button>
    </div>
  )
}
