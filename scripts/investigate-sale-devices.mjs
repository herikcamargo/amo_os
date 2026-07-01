#!/usr/bin/env node

import fs from 'fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const ENV_FILE = new URL('../.env', import.meta.url)
if (fs.existsSync(ENV_FILE)) {
  const envText = fs.readFileSync(ENV_FILE, 'utf-8')
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

const databaseUrl = process.env.DATABASE_URL
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!databaseUrl) {
  console.error('DATABASE_URL nao configurado no .env')
  process.exit(1)
}

function inferProjectRefFromUrl(value) {
  return value?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null
}

function safeUrlInfo(value) {
  if (!value) return { present: false }
  try {
    const parsed = new URL(value)
    return { present: true, host: parsed.host, length: value.length }
  } catch {
    return { present: true, host: null, length: value.length }
  }
}

function inferProjectRefFromDatabaseUrl(value) {
  return value?.match(/postgres\.([^.@:]+)[:@]/)?.[1] || value?.match(/db\.([^.]+)\.supabase\.co/)?.[1] || null
}

function summarizePolicies(rows) {
  return rows.map((row) => ({
    policyname: row.policyname,
    cmd: row.cmd,
    roles: row.roles,
    qual: row.qual,
    with_check: row.with_check,
  }))
}

function cleanRow(row) {
  return {
    id: row.id,
    marca: row.marca,
    modelo: row.modelo,
    status: row.status,
    product_category: row.product_category,
    stock_quantity: row.stock_quantity,
    preco_venda: row.preco_venda,
    sku: row.sku,
    barcode: row.barcode,
    supplier_id: row.supplier_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    length: row.length,
    char_length: row.char_length,
    model_hex: row.model_hex,
    invisible_or_extra_spaces: row.invisible_or_extra_spaces,
  }
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  const table = await client.query(`
    select c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sale_devices'
  `)

  const columns = await client.query(`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_devices'
    order by ordinal_position
  `)

  const policies = await client.query(`
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'sale_devices'
    order by policyname, cmd
  `)

  const directSummary = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where product_category = 'celular')::int as celulares,
      count(*) filter (where status = 'disponivel')::int as disponiveis,
      count(*) filter (where status = 'vendido')::int as vendidos,
      count(*) filter (where status = 'cancelado')::int as cancelados,
      count(*) filter (where stock_quantity > 0)::int as estoque_positivo
    from public.sale_devices
  `)

  const realmeRows = await client.query(`
    select
      id, marca, modelo, status, product_category, stock_quantity, preco_venda,
      sku, barcode, supplier_id, created_at, updated_at,
      length(modelo) as length,
      char_length(modelo) as char_length,
      encode(convert_to(modelo, 'UTF8'), 'hex') as model_hex,
      modelo <> btrim(regexp_replace(modelo, '\\s+', ' ', 'g')) as invisible_or_extra_spaces
    from public.sale_devices
    where concat_ws(' ', marca, modelo, product_category, sku, barcode, observacoes) ilike '%realme%'
    order by modelo, id
  `)

  const c75c85Rows = await client.query(`
    select
      id, marca, modelo, status, product_category, stock_quantity, preco_venda,
      sku, barcode, supplier_id, created_at, updated_at,
      length(modelo) as length,
      char_length(modelo) as char_length,
      encode(convert_to(modelo, 'UTF8'), 'hex') as model_hex,
      modelo <> btrim(regexp_replace(modelo, '\\s+', ' ', 'g')) as invisible_or_extra_spaces
    from public.sale_devices
    where normalize(modelo) ilike '%c75%'
       or normalize(modelo) ilike '%c85%'
       or modelo ilike '%C75%'
       or modelo ilike '%C85%'
       or concat_ws(' ', marca, modelo, observacoes) ilike '%realme%c75%'
       or concat_ws(' ', marca, modelo, observacoes) ilike '%realme%c85%'
    order by modelo, id
  `)

  await client.query('begin')
  await client.query('set local role authenticated')
  await client.query("set local request.jwt.claim.role = 'authenticated'")
  const authenticatedSummary = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where concat_ws(' ', marca, modelo, product_category, sku, barcode, observacoes) ilike '%realme%')::int as realme,
      count(*) filter (where modelo ilike '%C75%' or modelo ilike '%C85%')::int as c75_c85
    from public.sale_devices
  `)
  await client.query('rollback')

  const supabaseApi = { skipped: 'VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausente' }
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const pageSize = 1000
    let apiRows = []
    let apiError = null
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('sale_devices')
        .select('*')
        .order('modelo')
        .range(from, from + pageSize - 1)
      if (error) {
        apiError = { message: error.message, code: error.code, details: error.details }
        break
      }
      apiRows = apiRows.concat(data || [])
      if (!data || data.length < pageSize) break
    }
    Object.assign(supabaseApi, {
      skipped: undefined,
      error: apiError,
      total: apiRows.length,
      realme: apiRows.filter((item) => `${item.marca} ${item.modelo} ${item.product_category} ${item.sku} ${item.barcode} ${item.observacoes}`.toLowerCase().includes('realme')).length,
      c75_c85: apiRows.filter((item) => /c75|c85/i.test(item.modelo || '')).map((item) => cleanRow({
        ...item,
        length: (item.modelo || '').length,
        char_length: Array.from(item.modelo || '').length,
        model_hex: Buffer.from(item.modelo || '', 'utf8').toString('hex'),
        invisible_or_extra_spaces: (item.modelo || '') !== (item.modelo || '').replace(/\s+/g, ' ').trim(),
      })),
    })
  }

  console.log(JSON.stringify({
    environment: {
      table: 'public.sale_devices',
      database_project_ref: inferProjectRefFromDatabaseUrl(databaseUrl),
      vite_project_ref: inferProjectRefFromUrl(supabaseUrl),
      same_project: inferProjectRefFromDatabaseUrl(databaseUrl) === inferProjectRefFromUrl(supabaseUrl),
      vite_supabase_url: safeUrlInfo(supabaseUrl),
    },
    table: {
      rls_enabled: Boolean(table.rows[0]?.relrowsecurity),
      force_rls: Boolean(table.rows[0]?.relforcerowsecurity),
      columns: columns.rows,
      policies: summarizePolicies(policies.rows),
    },
    direct_sql_service_connection: {
      summary: directSummary.rows[0],
      realme_count: realmeRows.rowCount,
      realme: realmeRows.rows.map(cleanRow),
      c75_c85_count: c75c85Rows.rowCount,
      c75_c85: c75c85Rows.rows.map(cleanRow),
    },
    direct_sql_as_authenticated_role: authenticatedSummary.rows[0],
    supabase_js_same_query_without_login: supabaseApi,
  }, null, 2))
} finally {
  await client.end()
}
