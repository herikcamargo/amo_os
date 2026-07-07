#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// AMO OS — Import dos dados migrados do FPQ System pro Supabase
//
// Le os arquivos preparados por prepare.mjs (customers/devices/
// service_orders.json) e insere no Supabase via conexao direta
// (bypassa RLS, igual ao scripts/import-products.mjs).
//
// Idempotente: usa "on conflict (id) do update", pode rodar
// varias vezes sem duplicar dados.
//
// Uso:
//   node scripts/legacy-fpq/import.mjs --input "C:/caminho/final" --dry-run   (padrao, nao grava nada)
//   node scripts/legacy-fpq/import.mjs --input "C:/caminho/final" --apply    (grava de verdade)
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

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const inputDir = getArg('--input') || 'C:/Users/herik/Downloads/AMO_OS_dados_migrados/migracao/final'

function getArg(name) {
  const idx = args.indexOf(name)
  return idx >= 0 ? args[idx + 1] : null
}

function readJson(file) {
  const full = path.join(inputDir, file)
  if (!fs.existsSync(full)) throw new Error(`Arquivo nao encontrado: ${full}. Rode prepare.mjs primeiro.`)
  return JSON.parse(fs.readFileSync(full, 'utf-8'))
}

function chunks(items, size) {
  const result = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

async function upsertBatch(client, table, columns, rows, jsonColumns = []) {
  if (rows.length === 0) return
  const values = []
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * columns.length
    for (const col of columns) {
      const value = row[col]
      values.push(jsonColumns.includes(col) && value !== null ? JSON.stringify(value) : value)
    }
    return `(${columns.map((_, colIndex) => `$${offset + colIndex + 1}`).join(', ')})`
  })

  const updateSet = columns
    .filter((c) => !['id', 'created_at'].includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')

  await client.query(`
    insert into public.${table} (${columns.join(', ')})
    values ${placeholders.join(',\n')}
    on conflict (id) do update set ${updateSet}
  `, values)
}

async function run() {
  console.log('\n  AMO OS — Import dos dados legados FPQ System\n')
  console.log(`  Modo: ${apply ? 'APLICANDO no Supabase' : 'DRY RUN (nada sera gravado)'}`)
  console.log(`  Origem: ${inputDir}\n`)

  const customers = readJson('customers.json')
  const devices = readJson('devices.json')
  const orders = readJson('service_orders.json')

  console.log(`  Clientes a importar: ${customers.length}`)
  console.log(`  Aparelhos a importar: ${devices.length}`)
  console.log(`  Ordens a importar: ${orders.length}`)

  console.log('\n  Amostra (3 primeiros clientes):')
  for (const c of customers.slice(0, 3)) {
    console.log(`    - ${c.nome} | ${c.telefone || '(sem telefone)'} | cod antigo: ${c.legacy_cod}`)
  }
  console.log('\n  Amostra (3 primeiras ordens):')
  for (const o of orders.slice(0, 3)) {
    console.log(`    - ${o.numero} | status: ${o.status} | valor: R$${o.valor_servico}`)
  }

  if (!apply) {
    console.log('\n  Dry-run concluido. Nada foi gravado.')
    console.log('  Para gravar de verdade, rode novamente com --apply\n')
    return
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL nao encontrado no .env')

  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const startedAt = new Date().toISOString()
  try {
    console.log('\n  Importando clientes...')
    const customerColumns = ['id', 'nome', 'telefone', 'cpf', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'created_at', 'legacy_system', 'legacy_cod']
    for (const batch of chunks(customers, 500)) {
      await upsertBatch(client, 'customers', customerColumns, batch)
    }
    console.log(`  ✓ ${customers.length} clientes`)

    console.log('\n  Importando aparelhos...')
    const deviceColumns = ['id', 'customer_id', 'marca', 'modelo', 'cor', 'imei', 'senha_desbloqueio', 'acessorios', 'created_at']
    for (const batch of chunks(devices, 500)) {
      await upsertBatch(client, 'devices', deviceColumns, batch)
    }
    console.log(`  ✓ ${devices.length} aparelhos`)

    console.log('\n  Importando ordens de servico...')
    const orderColumns = [
      'id', 'numero', 'customer_id', 'device_id', 'status', 'problema_relatado', 'condicao_estetica',
      'diagnostico', 'servico_executado', 'pecas_utilizadas', 'valor_servico', 'garantia_dias', 'created_by',
      'created_at', 'updated_at', 'payment_method', 'payment_status', 'legacy_system', 'legacy_data',
    ]
    for (const batch of chunks(orders, 300)) {
      await upsertBatch(client, 'service_orders', orderColumns, batch, ['condicao_estetica', 'legacy_data'])
    }
    console.log(`  ✓ ${orders.length} ordens de servico`)

    await client.query(`
      insert into public.legacy_import_log (source_system, entity, total_source, inserted, updated, skipped, notes, run_at, run_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, ['fpq', 'customers+devices+service_orders', customers.length + devices.length + orders.length,
        customers.length + devices.length + orders.length, 0, 0,
        `Import completo via scripts/legacy-fpq/import.mjs`, startedAt, 'cli'])

    console.log('\n  Import concluido com sucesso!')
    console.log(`  Total: ${customers.length} clientes, ${devices.length} aparelhos, ${orders.length} ordens\n`)
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error('\n  ERRO:', err.message)
  process.exit(1)
})
