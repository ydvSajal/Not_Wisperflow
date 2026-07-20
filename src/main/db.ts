import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import type { DailyStat, HistoryQuery, StatsSummary, TranscriptionRecord } from '@shared/types'

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
