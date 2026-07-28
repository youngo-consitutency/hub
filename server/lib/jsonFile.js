import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** Read a JSON file, or return fallback when missing/unreadable. */
export function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    /* empty */
  }
  return fallback
}

/** Write pretty JSON, creating parent directories as needed. */
export function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}
