import { describe, expect, it } from 'vitest'
import { parseDBML } from './dbml-parser'

describe('parseDBML', () => {
  it('mem-parse satu tabel dengan tipe kolom, pk, unique, not null, dan default', () => {
    const result = parseDBML(`Table users {
  id uuid [pk]
  email varchar(255) [unique, not null]
  status varchar(32) [default: 'active', not null]
}`)

    expect(result.errors).toEqual([])
    expect(result.refs).toEqual([])
    expect(result.tables).toHaveLength(1)

    const table = result.tables[0]
    expect(table.name).toBe('users')
    expect(table.alias).toBeUndefined()
    expect(table.columns.map((c) => c.name)).toEqual(['id', 'email', 'status'])

    expect(table.columns[0]).toMatchObject({
      name: 'id',
      type: 'uuid',
      isPk: true,
      isNotNull: true,
      isUnique: false,
      isFk: false
    })
    expect(table.columns[1]).toMatchObject({
      name: 'email',
      type: 'varchar(255)',
      isPk: false,
      isUnique: true,
      isNotNull: true
    })
    expect(table.columns[2].isNotNull).toBe(true)
    // Parser saat ini hanya membaca flag; nilai default tidak disimpan.
    expect(table.columns[2].defaultValue).toBeUndefined()
  })

  it('membaca alias tabel ("Table users as U {")', () => {
    const result = parseDBML(`Table users as U {
  id uuid [pk]
}`)

    expect(result.errors).toEqual([])
    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].name).toBe('users')
    expect(result.tables[0].alias).toBe('U')
  })

  it('menghasilkan DBMLReference dari ref inline ("[ref: > users.id]")', () => {
    const result = parseDBML(`Table users {
  id uuid [pk]
}

Table posts {
  id uuid [pk]
  user_id uuid [not null, ref: > users.id]
}`)

    expect(result.errors).toEqual([])
    expect(result.refs).toHaveLength(1)
    expect(result.refs[0]).toEqual({
      id: 'ref-posts.user_id-users.id',
      sourceTable: 'posts',
      sourceColumn: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
      relationType: '>'
    })

    const posts = result.tables.find((t) => t.name === 'posts')
    const userId = posts?.columns.find((c) => c.name === 'user_id')
    expect(userId?.isFk).toBe(true)
    expect(userId?.refTarget).toEqual({
      table: 'users',
      column: 'id',
      relationType: '>'
    })
  })

  it('menghasilkan DBMLReference dari ref standalone ("Ref: posts.user_id > users.id")', () => {
    const result = parseDBML(`Table users {
  id uuid [pk]
}

Table posts {
  id uuid [pk]
  user_id uuid
}

Ref: posts.user_id > users.id`)

    expect(result.errors).toEqual([])
    expect(result.refs).toHaveLength(1)
    expect(result.refs[0]).toEqual({
      id: 'ref-posts.user_id-users.id',
      sourceTable: 'posts',
      sourceColumn: 'user_id',
      targetTable: 'users',
      targetColumn: 'id',
      relationType: '>'
    })
  })

  it('mengabaikan komentar "//"', () => {
    const result = parseDBML(`// komentar tingkat atas
Table users {
  // komentar di dalam tabel
  id uuid [pk] // komentar inline
  name varchar(120)
}`)

    expect(result.errors).toEqual([])
    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].columns.map((c) => c.name)).toEqual(['id', 'name'])
  })

  it('melaporkan tabel yang tidak ditutup "}" dengan nomor baris yang akurat', () => {
    const source = `Table users {
  id uuid [pk]
  name varchar(120)`
    const result = parseDBML(source)

    expect(result.tables).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(3)
    expect(result.errors[0].message).toContain("Tabel 'users' belum ditutup")
  })

  it('menghasilkan tables/refs/errors kosong untuk input kosong', () => {
    expect(parseDBML('')).toEqual({ tables: [], refs: [], errors: [] })
    expect(parseDBML('   \n  \n')).toEqual({ tables: [], refs: [], errors: [] })
  })
})
