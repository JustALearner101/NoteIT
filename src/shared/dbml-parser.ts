import type { MarkerColor } from './types/domain'

export interface DBMLColumn {
  name: string
  type: string
  isPk: boolean
  isFk: boolean
  isUnique: boolean
  isNotNull: boolean
  defaultValue?: string
  note?: string
  refTarget?: {
    table: string
    column: string
    relationType: '>' | '<' | '-' | '<>'
  }
}

export interface DBMLTable {
  name: string
  alias?: string
  headerColor?: MarkerColor
  columns: DBMLColumn[]
}

export interface DBMLReference {
  id: string
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  relationType: '>' | '<' | '-' | '<>'
}

export interface DBMLParseError {
  line: number
  message: string
}

export interface DBMLParseResult {
  tables: DBMLTable[]
  refs: DBMLReference[]
  errors: DBMLParseError[]
}

const DEFAULT_TABLE_COLORS: MarkerColor[] = ['cobalt', 'amber', 'teal', 'violet', 'red', 'slate']

/**
 * Pure offline DBML parser supporting:
 * - Table name { col type [pk, unique, not null, ref: > target.col, default: ...] }
 * - Standalone Ref: source.col > target.col
 * - Line-accurate error diagnostics in NoteIT's interface voice
 */
export function parseDBML(source: string): DBMLParseResult {
  const tables: DBMLTable[] = []
  const refs: DBMLReference[] = []
  const errors: DBMLParseError[] = []

  const lines = source.split(/\r?\n/)
  let currentTable: DBMLTable | null = null
  let tableIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const rawLine = lines[i]
    const stripped = rawLine.replace(/\/\/.*$/, '').trim()
    if (!stripped) continue

    // Match Table header: Table users as U [headercolor: cobalt] {
    const tableMatch = stripped.match(
      /^Table\s+([a-zA-Z0-9_."]+)(?:\s+as\s+([a-zA-Z0-9_]+))?(?:\s*\[([^\]]+)\])?\s*\{?$/i
    )
    if (tableMatch) {
      if (currentTable) {
        errors.push({
          line: lineNum,
          message: `Baris ${lineNum}: Tabel '${currentTable.name}' belum ditutup dengan '}' sebelum mendefinisikan tabel '${tableMatch[1]}'.`
        })
      }
      const name = tableMatch[1].replace(/"/g, '')
      const alias = tableMatch[2]
      const settingsRaw = tableMatch[3] || ''
      const colorMatch = settingsRaw.match(/color\s*:\s*(cobalt|amber|teal|red|violet|slate)/i)
      const headerColor = (colorMatch?.[1]?.toLowerCase() as MarkerColor) ||
        DEFAULT_TABLE_COLORS[tableIndex % DEFAULT_TABLE_COLORS.length]

      currentTable = {
        name,
        alias,
        headerColor,
        columns: []
      }
      tables.push(currentTable)
      tableIndex++
      continue
    }

    // End of table block
    if (stripped === '}') {
      if (!currentTable) {
        errors.push({
          line: lineNum,
          message: `Baris ${lineNum}: Ditemukan kurung tutup '}' tanpa blok Table yang aktif.`
        })
      }
      currentTable = null
      continue
    }

    // Standalone Ref: e.g. Ref: orders.user_id > users.id
    const standaloneRefMatch = stripped.match(
      /^Ref(?:\s+[a-zA-Z0-9_]+)?\s*:\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*(<>|>|<|-)\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/i
    )
    if (standaloneRefMatch) {
      const [, srcTable, srcCol, rel, tgtTable, tgtCol] = standaloneRefMatch
      refs.push({
        id: `ref-${srcTable}.${srcCol}-${tgtTable}.${tgtCol}`,
        sourceTable: srcTable,
        sourceColumn: srcCol,
        targetTable: tgtTable,
        targetColumn: tgtCol,
        relationType: rel as '>' | '<' | '-' | '<>'
      })
      continue
    }

    // Inside a Table block: parse column definition
    if (currentTable) {
      if (stripped.toLowerCase().startsWith('indexes') || stripped.startsWith('(')) {
        continue
      }
      const colMatch = stripped.match(/^([a-zA-Z0-9_"]+)\s+([a-zA-Z0-9_(),.]+)(?:\s*\[([^\]]+)\])?/)
      if (!colMatch) {
        errors.push({
          line: lineNum,
          message: `Baris ${lineNum}: Sintaks kolom '${stripped}' pada tabel '${currentTable.name}' tidak valid. Gunakan format: nama_kolom tipe_data [atribut].`
        })
        continue
      }

      const colName = colMatch[1].replace(/"/g, '')
      const colType = colMatch[2]
      const modifiers = colMatch[3] || ''

      const isPk = /\b(pk|primary\s+key)\b/i.test(modifiers)
      const isUnique = /\bunique\b/i.test(modifiers)
      const isNotNull = /\bnot\s+null\b/i.test(modifiers) || isPk

      let isFk = false
      let refTarget: DBMLColumn['refTarget'] | undefined

      const inlineRefMatch = modifiers.match(
        /ref\s*:\s*(<>|>|<|-)\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/i
      )
      if (inlineRefMatch) {
        isFk = true
        const [, rel, tgtTable, tgtCol] = inlineRefMatch
        refTarget = {
          table: tgtTable,
          column: tgtCol,
          relationType: rel as '>' | '<' | '-' | '<>'
        }
        refs.push({
          id: `ref-${currentTable.name}.${colName}-${tgtTable}.${tgtCol}`,
          sourceTable: currentTable.name,
          sourceColumn: colName,
          targetTable: tgtTable,
          targetColumn: tgtCol,
          relationType: rel as '>' | '<' | '-' | '<>'
        })
      }

      currentTable.columns.push({
        name: colName,
        type: colType,
        isPk,
        isFk,
        isUnique,
        isNotNull,
        refTarget
      })
    }
  }

  if (currentTable) {
    errors.push({
      line: lines.length,
      message: `Baris ${lines.length}: Tabel '${currentTable.name}' belum ditutup dengan kurung kurawal '}'.`
    })
  }

  // Resolve aliases and validate reference targets
  const tableMap = new Map<string, DBMLTable>()
  for (const t of tables) {
    tableMap.set(t.name, t)
    if (t.alias) tableMap.set(t.alias, t)
  }

  for (const ref of refs) {
    const srcT = tableMap.get(ref.sourceTable)
    const tgtT = tableMap.get(ref.targetTable)

    if (!srcT) {
      errors.push({
        line: 1,
        message: `Relasi '${ref.sourceTable}.${ref.sourceColumn}' merujuk ke tabel '${ref.sourceTable}' yang belum didefinisikan.`
      })
      continue
    }
    if (!tgtT) {
      errors.push({
        line: 1,
        message: `Kolom '${ref.sourceColumn}' pada tabel '${srcT.name}' merujuk ke tabel '${ref.targetTable}' yang belum didefinisikan.`
      })
      continue
    }

    // Normalize alias names to actual table names
    ref.sourceTable = srcT.name
    ref.targetTable = tgtT.name

    const srcCol = srcT.columns.find((c) => c.name === ref.sourceColumn)
    if (srcCol) {
      srcCol.isFk = true
      srcCol.refTarget = {
        table: tgtT.name,
        column: ref.targetColumn,
        relationType: ref.relationType
      }
    }
  }

  return { tables, refs, errors }
}

/**
 * Generates clean SQL DDL (PostgreSQL / SQLite) from parsed DBML
 */
export function generateSQLFromDBML(
  parsed: DBMLParseResult,
  dialect: 'postgres' | 'sqlite' = 'postgres'
): string {
  const chunks: string[] = [
    `-- Generated by NoteIT v2.0 DBML Studio (${dialect.toUpperCase()})`,
    `-- Timestamp: ${new Date().toISOString()}`,
    ''
  ]

  for (const table of parsed.tables) {
    const colLines: string[] = []
    for (const col of table.columns) {
      const parts = [`  "${col.name}" ${col.type.toUpperCase()}`]
      if (col.isPk) parts.push('PRIMARY KEY')
      if (col.isUnique && !col.isPk) parts.push('UNIQUE')
      if (col.isNotNull && !col.isPk) parts.push('NOT NULL')
      colLines.push(parts.join(' '))
    }

    const tableRefs = parsed.refs.filter((r) => r.sourceTable === table.name)
    for (const r of tableRefs) {
      colLines.push(
        `  FOREIGN KEY ("${r.sourceColumn}") REFERENCES "${r.targetTable}" ("${r.targetColumn}")`
      )
    }

    chunks.push(`CREATE TABLE "${table.name}" (\n${colLines.join(',\n')}\n);\n`)
  }

  return chunks.join('\n')
}
