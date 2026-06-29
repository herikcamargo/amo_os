#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// AMO OS — Seed de precos para o Supabase
//
// Le o catalogo local (priceCatalog.ts) e insere no banco.
//
// Uso:
//   node scripts/seed-prices.mjs
//
// Requer mesmas env vars do migrate.mjs
// ═══════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(__dirname, '..', '.env')

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

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || ''
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || ''

if (!process.env.DATABASE_URL && (!PROJECT_REF || !DB_PASSWORD)) {
  console.error('\n  Use DATABASE_URL ou SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD\n')
  process.exit(1)
}

const DB_URL = process.env.DATABASE_URL || `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`

function parseCatalog() {
  let raw = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'priceCatalog.ts'), 'utf-8')
  // Strip BOM
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)

  // Find the array after PRICE_CATALOG
  const lines = raw.split('\n')
  let inArray = false
  let depth = 0
  const arrayLines = []

  for (const line of lines) {
    if (!inArray && line.includes('PRICE_CATALOG:') && line.includes('= [')) {
      inArray = true
      arrayLines.push('[')
      depth = 1
      continue
    }
    if (inArray) {
      arrayLines.push(line)
      for (const ch of line) {
        if (ch === '[') depth++
        else if (ch === ']') depth--
      }
      if (depth <= 0) break
    }
  }

  const jsonStr = arrayLines.join('\n').replace(/,(\s*[}\]])/g, '$1')
  const result = JSON.parse(jsonStr)
  console.log(`  DEBUG: parsed ${result.length} items`)
  return result
}

function escSQL(str) {
  if (str === null || str === undefined) return 'NULL'
  return `'${String(str).replace(/'/g, "''")}'`
}

function numSQL(n) {
  if (n === null || n === undefined) return 'NULL'
  return String(Number(n))
}

async function run() {
  let pg
  try {
    pg = (await import('pg')).default
  } catch {
    console.log('Instalando driver pg...')
    const { execSync } = await import('child_process')
    execSync('npm install pg --save-dev', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
    pg = (await import('pg')).default
  }

  const catalog = parseCatalog()
  console.log(`\n  Catalogo: ${catalog.length} modelos encontrados`)

  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('  Conectado ao Supabase\n')

  // Limpar tabelas
  await client.query('DELETE FROM public.price_services')
  await client.query('DELETE FROM public.price_catalog')
  console.log('  Tabelas limpas')

  // Inserir em lotes de 100
  const BATCH = 100
  let catalogCount = 0
  let serviceCount = 0

  for (let i = 0; i < catalog.length; i += BATCH) {
    const batch = catalog.slice(i, i + BATCH)

    // Insert catalogs
    const catalogValues = batch.map(item =>
      `(${escSQL(item.id)}, ${escSQL(item.brand)}, ${escSQL(item.model)}, ${escSQL(item.search)})`
    ).join(',\n')

    await client.query(`
      INSERT INTO public.price_catalog (id, brand, model, search)
      VALUES ${catalogValues}
      ON CONFLICT (id) DO UPDATE SET
        brand = EXCLUDED.brand,
        model = EXCLUDED.model,
        search = EXCLUDED.search,
        updated_at = now()
    `)
    catalogCount += batch.length

    // Insert services
    const serviceRows = []
    for (const item of batch) {
      for (const svc of item.services || []) {
        serviceRows.push(
          `(${escSQL(item.id)}, ${escSQL(svc.key)}, ${escSQL(svc.label)}, ${escSQL(svc.sourceLabel || null)}, ${escSQL(svc.quality || null)}, ${numSQL(svc.finalPrice)}, ${numSQL(svc.installmentPrice)}, ${numSQL(svc.costPrice)}, ${escSQL(svc.note || null)})`
        )
      }
    }

    if (serviceRows.length > 0) {
      // Insert services in sub-batches of 200
      for (let j = 0; j < serviceRows.length; j += 200) {
        const subBatch = serviceRows.slice(j, j + 200)
        await client.query(`
          INSERT INTO public.price_services (catalog_id, key, label, source_label, quality, final_price, installment_price, cost_price, note)
          VALUES ${subBatch.join(',\n')}
          ON CONFLICT (catalog_id, key) DO UPDATE SET
            label = EXCLUDED.label,
            source_label = EXCLUDED.source_label,
            quality = EXCLUDED.quality,
            final_price = EXCLUDED.final_price,
            installment_price = EXCLUDED.installment_price,
            cost_price = EXCLUDED.cost_price,
            note = EXCLUDED.note
        `)
        serviceCount += subBatch.length
      }
    }

    process.stdout.write(`  Progresso: ${catalogCount}/${catalog.length} modelos, ${serviceCount} servicos\r`)
  }

  await client.end()
  console.log(`\n\n  Pronto! ${catalogCount} modelos e ${serviceCount} servicos inseridos.\n`)
}

run().catch(err => {
  console.error('Erro:', err.message)
  process.exit(1)
})
