#!/usr/bin/env node

import fs from 'fs'
import pg from 'pg'

const ENV_FILE = new URL('../.env', import.meta.url)
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

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL nao configurado no .env')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

try {
  const summary = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where status = 'disponivel')::int as disponiveis,
      count(*) filter (where stock_quantity > 0)::int as estoque_positivo,
      sum(greatest(stock_quantity, 0))::int as unidades,
      max(stock_quantity)::int as maior_estoque
    from public.sale_devices
  `)

  const categories = await client.query(`
    select coalesce(product_category, 'sem_categoria') as categoria, count(*)::int as total
    from public.sale_devices
    group by 1
    order by total desc
  `)

  const realme = await client.query(`
    select modelo, marca, product_category, status, stock_quantity, preco_venda, sku
    from public.sale_devices
    where concat_ws(' ', marca, modelo, product_category, sku, observacoes) ilike '%realme%'
    order by modelo
  `)

  const highStock = await client.query(`
    select modelo, marca, product_category, status, stock_quantity, preco_venda, sku, observacoes
    from public.sale_devices
    where stock_quantity > 1000
    order by stock_quantity desc
    limit 20
  `)

  console.log(JSON.stringify({
    summary: summary.rows[0],
    categories: categories.rows,
    realme_count: realme.rowCount,
    realme: realme.rows,
    high_stock: highStock.rows,
  }, null, 2))
} finally {
  await client.end()
}
