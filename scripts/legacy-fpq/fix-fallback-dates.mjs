#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Corrige as OS legadas cuja data original era invalida/ausente no
// DBF e por isso caíram no fallback "agora" durante o prepare.mjs
// (rodado antes desta correcao existir). Estima a data pela OS
// vizinha mais proxima (numero antigo sequencial e cronologico no
// FPQ System), em vez de fingir que a entrada foi hoje.
//
// Uso:
//   node scripts/legacy-fpq/fix-fallback-dates.mjs --dry-run  (padrao)
//   node scripts/legacy-fpq/fix-fallback-dates.mjs --apply
// ═══════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(__dirname, '..', '..', '.env')

if (fs.existsSync(ENV_FILE)) {
  const envText = fs.readFileSync(ENV_FILE, 'utf-8')
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

const apply = process.argv.includes('--apply')

async function run() {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    const all = await client.query(`
      select id, numero, created_at,
        (regexp_replace(numero, '\\D', '', 'g'))::int as seq
      from service_orders
      where legacy_system = 'fpq'
      order by seq asc
    `)

    const today = new Date().toDateString()
    const rows = all.rows
    const fallbackIndexes = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => new Date(r.created_at).toDateString() === today)

    console.log(`\n  Encontrados ${fallbackIndexes.length} registros com data de fallback (hoje)\n`)

    const updates = []
    for (const { r, i } of fallbackIndexes) {
      // procura vizinho valido mais proximo (anterior primeiro, depois seguinte)
      let estimated = null
      for (let offset = 1; offset < rows.length; offset++) {
        const prev = rows[i - offset]
        if (prev && new Date(prev.created_at).toDateString() !== today) { estimated = prev.created_at; break }
        const next = rows[i + offset]
        if (next && new Date(next.created_at).toDateString() !== today) { estimated = next.created_at; break }
      }
      if (estimated) updates.push({ id: r.id, numero: r.numero, from: r.created_at, to: estimated })
    }

    for (const u of updates) {
      console.log(`  ${u.numero}: ${new Date(u.from).toISOString()} -> ${new Date(u.to).toISOString()} (estimado)`)
    }

    if (!apply) {
      console.log(`\n  Dry-run. Rode com --apply para gravar ${updates.length} correcoes.\n`)
      return
    }

    for (const u of updates) {
      await client.query(`
        update service_orders
        set created_at = $1,
            updated_at = $1,
            legacy_data = coalesce(legacy_data, '{}'::jsonb) || jsonb_build_object('data_estimada', true, 'data_original_invalida', true)
        where id = $2
      `, [u.to, u.id])
    }
    console.log(`\n  ${updates.length} registros corrigidos.\n`)
  } finally {
    await client.end()
  }
}

run().catch((err) => { console.error('ERRO:', err.message); process.exit(1) })
