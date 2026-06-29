#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// AMO OS — Migration Runner
//
// Executa arquivos SQL no Supabase sem precisar do SQL Editor.
//
// Uso:
//   node scripts/migrate.mjs                     # roda todas pendentes
//   node scripts/migrate.mjs 005                 # roda uma especifica
//   node scripts/migrate.mjs 005 006             # roda varias
//
// Requer:
//   SUPABASE_PROJECT_REF  (ex: emchdztjtsfgxlvgqlhp)
//   SUPABASE_DB_PASSWORD  (senha do banco, definida na criacao do projeto)
// ═══════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')
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
  console.error('\n  Opcao 1 — cole a connection string:')
  console.error('    DATABASE_URL=postgresql://... node scripts/migrate.mjs\n')
  console.error('  Opcao 2 — use ref + senha:')
  console.error('    SUPABASE_PROJECT_REF=emchdztjtsfgxlvgqlhp')
  console.error('    SUPABASE_DB_PASSWORD=sua_senha_do_banco\n')
  console.error('  Encontre a connection string em:')
  console.error('    Supabase > Settings > Database > Connection string > URI\n')
  process.exit(1)
}

const DB_URL = process.env.DATABASE_URL || `postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`

async function execSQL(sql, label) {
  // Fallback: use the direct pg connection via fetch to the REST SQL endpoint
  // Supabase exposes SQL execution via the service role + pg endpoint
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || ''

  if (serviceKey) {
    const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    })

    if (res.ok) {
      console.log(`  ✓ ${label}`)
      return true
    }
  }

  // Direct approach: use node's built-in to connect to PostgreSQL
  // We'll use a simple TCP approach via the pg wire protocol
  // Actually, let's just use dynamic import of pg if available, or fetch-based approach

  try {
    // Try using pg module
    const { default: pg } = await import('pg')
    const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query(sql)
    await client.end()
    console.log(`  ✓ ${label}`)
    return true
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('\n  Instalando driver PostgreSQL (uma vez so)...')
      const { execSync } = await import('child_process')
      execSync('npm install pg --save-dev', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
      // Retry
      const { default: pg } = await import('pg')
      const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
      await client.connect()
      await client.query(sql)
      await client.end()
      console.log(`  ✓ ${label}`)
      return true
    }
    throw err
  }
}

async function run() {
  const args = process.argv.slice(2)

  // List available migrations
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.log('Nenhuma migration encontrada.')
    return
  }

  // Filter by arguments
  let toRun = files
  if (args.length > 0) {
    toRun = files.filter(f => args.some((arg) => {
      const clean = arg.endsWith('.sql') ? arg : `${arg}.sql`
      return f === clean || f.includes(arg)
    }))
  }

  if (toRun.length === 0) {
    console.log('Nenhuma migration corresponde aos filtros:', args.join(', '))
    console.log('Disponiveis:', files.join(', '))
    return
  }

  console.log(`\n  AMO OS — Executando ${toRun.length} migration(s)\n`)

  for (const file of toRun) {
    const filePath = path.join(MIGRATIONS_DIR, file)
    const sql = fs.readFileSync(filePath, 'utf-8')
    try {
      await execSQL(sql, file)
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`)
      console.error('    Parando execucao.\n')
      process.exit(1)
    }
  }

  console.log(`\n  Pronto! ${toRun.length} migration(s) executada(s) com sucesso.\n`)
}

run().catch(err => {
  console.error('Erro fatal:', err.message)
  process.exit(1)
})
