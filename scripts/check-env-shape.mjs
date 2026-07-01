#!/usr/bin/env node

import fs from 'fs'

const keys = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'SUPABASE_PROJECT_REF',
])

const result = {}
const text = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : ''

for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
  const index = trimmed.indexOf('=')
  const key = trimmed.slice(0, index).trim()
  let value = trimmed.slice(index + 1).trim()
  value = value.replace(/^"/, '').replace(/"$/, '').replace(/^'/, '').replace(/'$/, '')
  if (!keys.has(key)) continue
  let host = null
  try {
    host = new URL(value).host
  } catch {
    host = null
  }
  result[key] = {
    present: true,
    length: value.length,
    looks_like_url: value.startsWith('http'),
    host,
  }
}

for (const key of keys) {
  if (!result[key]) result[key] = { present: false, length: 0, looks_like_url: false, host: null }
}

console.log(JSON.stringify(result, null, 2))
