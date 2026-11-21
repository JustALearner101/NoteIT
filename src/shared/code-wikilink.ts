export interface CodeWikiLinkTarget {
  relPath: string
  startLine?: number
  endLine?: number
  displayLabel: string
}

const CODE_FILE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'mts',
  'cts',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'md',
  'markdown',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'htm',
  'sql',
  'dbml',
  'py',
  'rs',
  'go',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'psm1',
  'yaml',
  'yml',
  'toml',
  'c',
  'cpp',
  'h',
  'hpp',
  'java',
  'kt',
  'rb',
  'php',
  'vue',
  'svelte',
  'astro',
  'xml',
  'svg',
  'txt',
  'env',
  'gitignore',
  'dockerfile',
  'lock'
])

const SPECIAL_CODE_FILENAMES = new Set([
  'dockerfile',
  'makefile',
  '.gitignore',
  '.env',
  '.env.example',
  'package.json',
  'tsconfig.json',
  'readme.md'
])

/**
 * Parses a raw `[[...]]` target string and determines if it references a repository
 * code file (e.g. `src/main/index.ts`, `src/main/index.ts#L120`, `src/main/index.ts#L10-L25`).
 *
 * Returns `null` if the target is a standard NoteIT page title (or contains path traversal).
 */
export function parseCodeWikiLink(rawTarget: string): CodeWikiLinkTarget | null {
  if (!rawTarget || typeof rawTarget !== 'string') return null

  const trimmed = rawTarget.trim()
  if (!trimmed || trimmed.includes('\0')) return null

  // Match optional `#L10` or `#L10-L25` or `#L10-25` suffix
  const hashMatch = /^([^#]+?)(?:#L(\d+)(?:-L?(\d+))?)?$/i.exec(trimmed)
  if (!hashMatch) return null

  const rawPathPart = hashMatch[1].trim()
  const rawStart = hashMatch[2]
  const rawEnd = hashMatch[3]

  if (!rawPathPart) return null

  // Reject URL schemes or Windows drive letters / absolute paths
  if (
    /^[a-zA-Z]+:\/\//.test(rawPathPart) ||
    /^[a-zA-Z]:/.test(rawPathPart) ||
    rawPathPart.startsWith('/') ||
    rawPathPart.startsWith('\\')
  ) {
    return null
  }

  // Normalize slashes and strip leading `./`
  const normalizedPath = rawPathPart.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!normalizedPath || normalizedPath.endsWith('/')) return null

  // Reject any `.` or `..` segments or empty double-slash segments
  const segments = normalizedPath.split('/')
  if (segments.some((seg) => !seg || seg === '.' || seg === '..')) {
    return null
  }

  const hasLineAnchor = rawStart !== undefined
  const hasDirectorySlash = segments.length > 1
  const fileName = segments[segments.length - 1]
  const lowerFileName = fileName.toLowerCase()

  const dotIdx = lowerFileName.lastIndexOf('.')
  const ext = dotIdx > 0 ? lowerFileName.slice(dotIdx + 1) : ''
  const hasKnownCodeExt =
    (ext.length > 0 && CODE_FILE_EXTENSIONS.has(ext)) ||
    SPECIAL_CODE_FILENAMES.has(lowerFileName)

  // Recognize as a code WikiLink if:
  // 1) It has an explicit `#L<num>` line anchor and looks like a file path (has extension or slash), OR
  // 2) It has a directory separator (`/`) AND a known code file extension / filename, OR
  // 3) It is a top-level known code filename with extension and no spaces (e.g. `package.json`, `tsconfig.json`)
  const hasWhitespace = /\s/.test(normalizedPath)
  if (hasWhitespace) return null

  const isCodeTarget =
    (hasLineAnchor && (hasKnownCodeExt || hasDirectorySlash || dotIdx > 0)) ||
    (hasDirectorySlash && hasKnownCodeExt) ||
    (!hasDirectorySlash && hasKnownCodeExt)

  if (!isCodeTarget) return null

  let startLine: number | undefined
  let endLine: number | undefined
  if (rawStart !== undefined) {
    const parsedStart = Number.parseInt(rawStart, 10)
    if (!Number.isFinite(parsedStart) || parsedStart < 1) return null
    startLine = parsedStart

    if (rawEnd !== undefined) {
      const parsedEnd = Number.parseInt(rawEnd, 10)
      if (!Number.isFinite(parsedEnd) || parsedEnd < 1) return null
      if (parsedEnd < parsedStart) {
        startLine = parsedEnd
        endLine = parsedStart
      } else {
        endLine = parsedEnd
      }
    }
  }

  const lineSuffix =
    startLine !== undefined
      ? endLine !== undefined && endLine !== startLine
        ? `#L${startLine}-L${endLine}`
        : `#L${startLine}`
      : ''

  return {
    relPath: normalizedPath,
    startLine,
    endLine,
    displayLabel: `${normalizedPath}${lineSuffix}`
  }
}
