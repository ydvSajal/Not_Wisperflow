import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import type {
  DailyStat,
  HistoryQuery,
  Note,
  Replacement,
  StatsSummary,
  TranscriptionRecord
} from '@shared/types'

let db: DatabaseSync | null = null

interface Row {
  id: number
  text: string
  raw_text: string
  words: number
  duration_ms: number
  wpm: number
  engine: string
  model: string
  created_at: number
}

function getDb(): DatabaseSync {
  if (db) return db
  db = new DatabaseSync(join(app.getPath('userData'), 'whisprflow.db'))
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      words INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      wpm REAL NOT NULL,
      engine TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_transcriptions_created ON transcriptions(created_at);
    CREATE TABLE IF NOT EXISTS replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      replacement TEXT NOT NULL,
      is_regex INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );
  `)
  return db
}

function toRecord(row: Row): TranscriptionRecord {
  return {
    id: row.id,
    text: row.text,
    rawText: row.raw_text,
    words: row.words,
    durationMs: row.duration_ms,
    wpm: row.wpm,
    engine: row.engine,
    model: row.model,
    createdAt: new Date(row.created_at).toISOString()
  }
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function insertTranscription(input: {
  text: string
  rawText: string
  durationMs: number
  engine: string
  model: string
}): TranscriptionRecord {
  const words = countWords(input.text)
  const minutes = input.durationMs / 60000
  const wpm = minutes > 0 ? Math.round(words / minutes) : 0
  const createdAt = Date.now()
  const result = getDb()
    .prepare(
      `INSERT INTO transcriptions (text, raw_text, words, duration_ms, wpm, engine, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(input.text, input.rawText, words, input.durationMs, wpm, input.engine, input.model, createdAt)
  return {
    id: Number(result.lastInsertRowid),
    text: input.text,
    rawText: input.rawText,
    words,
    durationMs: input.durationMs,
    wpm,
    engine: input.engine,
    model: input.model,
    createdAt: new Date(createdAt).toISOString()
  }
}

export function listHistory(query: HistoryQuery): TranscriptionRecord[] {
  const limit = Math.min(query.limit ?? 100, 500)
  const offset = query.offset ?? 0
  const rows = query.search
    ? (getDb()
        .prepare(
          `SELECT * FROM transcriptions WHERE text LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
        .all(`%${query.search}%`, limit, offset) as unknown as Row[])
    : (getDb()
        .prepare(`SELECT * FROM transcriptions ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(limit, offset) as unknown as Row[])
  return rows.map(toRecord)
}

export function deleteTranscription(id: number): void {
  getDb().prepare(`DELETE FROM transcriptions WHERE id = ?`).run(id)
}

export function clearHistory(): void {
  getDb().exec(`DELETE FROM transcriptions`)
}

// ---- Replacements (custom vocabulary) ----

interface ReplacementRow {
  id: number
  pattern: string
  replacement: string
  is_regex: number
}

export function listReplacements(): Replacement[] {
  const rows = getDb()
    .prepare(`SELECT * FROM replacements ORDER BY id`)
    .all() as unknown as ReplacementRow[]
  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    replacement: r.replacement,
    isRegex: r.is_regex === 1
  }))
}

export function addReplacement(input: Omit<Replacement, 'id'>): Replacement {
  if (!input.pattern) throw new Error('Pattern cannot be empty')
  if (input.isRegex) new RegExp(input.pattern) // throws on invalid regex before saving
  const result = getDb()
    .prepare(`INSERT INTO replacements (pattern, replacement, is_regex) VALUES (?, ?, ?)`)
    .run(input.pattern, input.replacement, input.isRegex ? 1 : 0)
  return { id: Number(result.lastInsertRowid), ...input }
}

export function deleteReplacement(id: number): void {
  getDb().prepare(`DELETE FROM replacements WHERE id = ?`).run(id)
}

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Apply all stored replacements (case-insensitive). Invalid regex rows are skipped. */
export function applyReplacements(text: string): string {
  let output = text
  for (const r of listReplacements()) {
    try {
      const source = r.isRegex ? r.pattern : `\\b${escapeRegex(r.pattern)}\\b`
      output = output.replace(new RegExp(source, 'gi'), r.replacement)
    } catch {
      // stored before validation existed or engine mismatch — skip silently
    }
  }
  return output
}

// ---- Notes ----

interface NoteRow {
  id: number
  title: string
  body: string
  updated_at: number
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    updatedAt: new Date(row.updated_at).toISOString()
  }
}

export function listNotes(search?: string): Note[] {
  const rows = search
    ? (getDb()
        .prepare(
          `SELECT * FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY updated_at DESC`
        )
        .all(`%${search}%`, `%${search}%`) as unknown as NoteRow[])
    : (getDb().prepare(`SELECT * FROM notes ORDER BY updated_at DESC`).all() as unknown as NoteRow[])
  return rows.map(toNote)
}

export function createNote(title: string): Note {
  const now = Date.now()
  const result = getDb()
    .prepare(`INSERT INTO notes (title, body, updated_at) VALUES (?, '', ?)`)
    .run(title || 'Untitled note', now)
  return { id: Number(result.lastInsertRowid), title: title || 'Untitled note', body: '', updatedAt: new Date(now).toISOString() }
}

export function updateNote(id: number, patch: { title?: string; body?: string }): Note {
  const row = getDb().prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as unknown as
    | NoteRow
    | undefined
  if (!row) throw new Error(`Note ${id} not found`)
  const title = patch.title ?? row.title
  const body = patch.body ?? row.body
  const now = Date.now()
  getDb()
    .prepare(`UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`)
    .run(title, body, now, id)
  return { id, title, body, updatedAt: new Date(now).toISOString() }
}

export function deleteNote(id: number): void {
  getDb().prepare(`DELETE FROM notes WHERE id = ?`).run(id)
}

export function appendToNote(id: number, text: string): Note {
  const row = getDb().prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as unknown as
    | NoteRow
    | undefined
  if (!row) throw new Error(`Note ${id} not found`)
  const body = row.body ? `${row.body}\n\n${text}` : text
  return updateNote(id, { body })
}

function localDayKey(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getStats(days = 30): StatsSummary {
  const totals = getDb()
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(words),0) AS words,
              COALESCE(SUM(duration_ms),0) AS duration, COALESCE(AVG(wpm),0) AS avg_wpm
       FROM transcriptions`
    )
    .get() as unknown as { count: number; words: number; duration: number; avg_wpm: number }

  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * (days + 1)
  const rows = getDb()
    .prepare(`SELECT created_at, words FROM transcriptions WHERE created_at >= ?`)
    .all(cutoff) as unknown as { created_at: number; words: number }[]

  const byDay = new Map<string, DailyStat>()
  for (const row of rows) {
    const day = localDayKey(row.created_at)
    const stat = byDay.get(day) ?? { day, words: 0, count: 0 }
    stat.words += row.words
    stat.count += 1
    byDay.set(day, stat)
  }
  // Fill the last `days` days so the chart has continuous bars
  const daily: DailyStat[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = localDayKey(Date.now() - i * 24 * 60 * 60 * 1000)
    daily.push(byDay.get(day) ?? { day, words: 0, count: 0 })
  }

  // Streak: consecutive days with activity ending today (or yesterday if today is empty)
  let streak = 0
  const today = localDayKey(Date.now())
  const startOffset = byDay.has(today) ? 0 : 1
  for (let i = startOffset; ; i++) {
    const day = localDayKey(Date.now() - i * 24 * 60 * 60 * 1000)
    if (byDay.has(day)) streak++
    else break
  }

  return {
    totalWords: totals.words,
    totalCount: totals.count,
    totalDurationMs: totals.duration,
    avgWpm: Math.round(totals.avg_wpm),
    streakDays: streak,
    daily
  }
}
