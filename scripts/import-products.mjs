#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(__dirname, '..', '.env')
const PRODUCT_NAMESPACE = '5ec0b17a-4a7f-4b9c-9274-38bdb514f43a'

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
const dryRun = !apply || args.includes('--dry-run')
const files = args.filter((arg) => !arg.startsWith('--'))

if (files.length === 0) {
  console.error('\nUso:')
  console.error('  node scripts/import-products.mjs caminho/produtos.csv caminho/outro.csv --dry-run')
  console.error('  node scripts/import-products.mjs caminho/produtos.csv caminho/outro.csv --apply\n')
  process.exit(1)
}

const rows = files.flatMap((file) => readCsvFile(file).map((row) => ({ ...row, __source_file: path.basename(file) })))
const normalized = normalizeProducts(rows)
const report = buildReport(rows, normalized)

printReport(report, dryRun)

if (apply) {
  await importToSupabase(normalized)
}

function readCsvFile(file) {
  const text = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '')
  const records = parseDelimited(text, ';')
  const [headers = [], ...body] = records

  return body
    .filter((record) => record.some((cell) => clean(cell)))
    .map((record) => Object.fromEntries(headers.map((header, index) => [clean(header), clean(record[index])])));
}

function parseDelimited(text, delimiter) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"'
        i += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (!quoted && char === delimiter) {
      row.push(cell)
      cell = ''
      continue
    }

    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function normalizeProducts(sourceRows) {
  const byId = new Map()

  for (const row of sourceRows) {
    const legacyId = clean(row.ID)
    const description = clean(row.Descrição || row.Descricao)
    if (!legacyId || !description) continue

    const existing = byId.get(legacyId)
    const current = mapProduct(row)
    if (!existing || current.stock_quantity > existing.stock_quantity || current.preco_venda > existing.preco_venda) {
      byId.set(legacyId, current)
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.modelo.localeCompare(b.modelo, 'pt-BR'))
}

function mapProduct(row) {
  const legacyId = clean(row.ID)
  const description = normalizeSpaces(row.Descrição || row.Descricao)
  const rawStock = parseBrazilianNumber(row.Estoque)
  const excessiveStock = rawStock > 9999
  const stock = excessiveStock ? 0 : Math.max(0, Math.round(rawStock))
  const category = inferCategory(row, description)
  const brand = inferBrand(row, description, category)
  const condition = normalize(row['Condição do Produto'] || row['Condicao do Produto'])
  const status = normalize(row.Situação || row.Situacao) === 'ativo' ? 'disponivel' : 'cancelado'
  const cost = parseBrazilianNumber(row['Preço de custo']) || parseBrazilianNumber(row['Preço de Compra'])
  const salePrice = parseBrazilianNumber(row.Preço || row.Preco)
  const barcode = onlyMeaningfulCode(row['GTIN/EAN'])
  const vendorCode = onlyMeaningfulCode(row['Cód. no fornecedor'] || row['Cod. no fornecedor'])
  const location = clean(row.Localização || row.Localizacao)
  const group = clean(row['Categoria do produto'] || row['Grupo de produtos'])
  const notes = [
    `Importado do cadastro antigo: ${legacyId}`,
    row.__source_file ? `Arquivo: ${row.__source_file}` : '',
    rawStock < 0 ? `Estoque original negativo: ${formatNumber(rawStock)}` : '',
    excessiveStock ? `Estoque original irreal: ${formatNumber(rawStock)}` : '',
    group ? `Categoria original: ${group}` : '',
    location ? `Localizacao: ${location}` : '',
    vendorCode ? `Codigo fornecedor: ${vendorCode}` : '',
  ].filter(Boolean).join(' | ')

  return {
    id: uuidFromName(`amo-os-product:${legacyId}`),
    photo_url: null,
    product_category: category,
    sku: `legacy-${legacyId}`,
    barcode,
    tipo: condition.includes('usado') ? 'usado' : condition.includes('seminovo') ? 'seminovo' : 'novo',
    marca: brand,
    modelo: description,
    cor: null,
    armazenamento: inferStorage(description),
    memoria_ram: null,
    imei1: null,
    imei2: null,
    serial: null,
    custo_compra: cost,
    preco_venda: salePrice,
    supplier_id: null,
    data_compra: null,
    condicao: clean(row['Condição do Produto'] || row['Condicao do Produto']) || 'NOVO',
    acessorios: null,
    garantia: warrantyText(row),
    observacoes: notes || null,
    status,
    stock_quantity: stock,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function inferCategory(row, description) {
  const text = normalize(`${row['Categoria do produto'] || ''} ${row['Grupo de produtos'] || ''} ${description}`)
  if (/(pelicula|hidrogel|vidro\s*3d|vidro\s*9d|privacidade)/.test(text)) return 'pelicula'
  if (/(^|\s)(capa|case|capinha|anti impacto|carteira)(\s|$)/.test(text)) return 'capa'
  if (/(carregador|fonte|tomada|turbo|magsafe|cabo\s*(usb|tipo|lightning|iphone)|usb-c|tipo c)/.test(text)) return 'carregador'
  if (/(celular|smartphone|\biphone\b|\bgalaxy\b|\bmoto\b|\bredmi\b|\bpoco\b|\brealme\b)/.test(text) && !/(pelicula|capa|case|fonte|carregador|cabo|fone)/.test(text)) return 'celular'
  if (/(fone|power bank|powerbank|suporte|tripe|trip[eé]|adaptador|relogio|watch|caixa de som|cartao|cart[aã]o|chip|controle|microfone|mouse|teclado|ring light|lampada|l[aâ]mpada|limpa tela|limpador|pop socket|popsocket|carteira magsafe)/.test(text)) return 'acessorio'
  return 'outro'
}

function inferBrand(row, description, category) {
  const fromBrand = clean(row.Marca)
  if (fromBrand && fromBrand !== '0') return titleCase(fromBrand)

  const text = normalize(description)
  const known = [
    ['Apple', /\b(apple|iphone|ipad|macbook|airpods)\b/],
    ['Samsung', /\b(samsung|galaxy)\b/],
    ['Motorola', /\b(motorola|moto)\b/],
    ['Xiaomi', /\b(xiaomi|redmi|mi |poco)\b/],
    ['Realme', /\brealme\b/],
    ['LG', /\blg\b/],
    ['Agold', /\bagold\b/],
    ['H Maston', /\b(hmaston|h-maston)\b/],
    ['It-Blue', /\b(itblue|it-blue)\b/],
    ['1Hora', /\b1hora\b/],
  ]

  return known.find(([, pattern]) => pattern.test(text))?.[0] || categoryLabel(category)
}

function inferStorage(description) {
  const match = description.match(/\b(\d{2,4})\s*(GB|TB)\b/i)
  return match ? `${match[1]}${match[2].toUpperCase()}` : null
}

function warrantyText(row) {
  const months = parseBrazilianNumber(row['Meses Garantia no Fornecedor'])
  return months > 0 ? `${Math.round(months)} meses fornecedor` : null
}

function buildReport(sourceRows, products) {
  const categoryCounts = countBy(products, 'product_category')
  const activeRows = sourceRows.filter((row) => normalize(row.Situação || row.Situacao) === 'ativo').length
  const withPositiveStock = products.filter((product) => product.stock_quantity > 0).length
  const zeroPrice = products.filter((product) => product.preco_venda <= 0).length
  const negativeStock = sourceRows.filter((row) => parseBrazilianNumber(row.Estoque) < 0).length
  const duplicateSourceIds = sourceRows.length - new Set(sourceRows.map((row) => clean(row.ID)).filter(Boolean)).size

  return {
    sourceRows: sourceRows.length,
    normalizedProducts: products.length,
    activeRows,
    withPositiveStock,
    zeroPrice,
    negativeStock,
    duplicateSourceIds,
    categoryCounts,
  }
}

function printReport(report, isDryRun) {
  console.log('\nAMO.OS - Previa da migracao de produtos\n')
  console.log(`Modo: ${isDryRun ? 'dry-run, nada foi gravado no Supabase' : 'apply, gravando no Supabase'}`)
  console.log(`Linhas lidas: ${report.sourceRows}`)
  console.log(`Produtos normalizados: ${report.normalizedProducts}`)
  console.log(`Produtos ativos na origem: ${report.activeRows}`)
  console.log(`Produtos com estoque positivo: ${report.withPositiveStock}`)
  console.log(`Produtos com preco zerado: ${report.zeroPrice}`)
  console.log(`Linhas com estoque negativo na origem: ${report.negativeStock}`)
  console.log(`IDs duplicados na origem: ${report.duplicateSourceIds}`)
  console.log('\nCategorias mapeadas:')
  for (const [category, count] of Object.entries(report.categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category}: ${count}`)
  }
  console.log('')
}

async function importToSupabase(products) {
  const dbUrl = process.env.DATABASE_URL || buildSupabaseDbUrl()
  if (!dbUrl) {
    throw new Error('Informe DATABASE_URL ou SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD no .env antes de usar --apply.')
  }

  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    for (const batch of chunks(products, 100)) {
      await upsertBatch(client, batch)
    }
  } finally {
    await client.end()
  }

  console.log(`Importacao concluida: ${products.length} produtos enviados para public.sale_devices.\n`)
}

async function upsertBatch(client, products) {
  const columns = [
    'id', 'photo_url', 'product_category', 'sku', 'barcode', 'tipo', 'marca', 'modelo', 'cor', 'armazenamento',
    'memoria_ram', 'imei1', 'imei2', 'serial', 'custo_compra', 'preco_venda', 'supplier_id', 'data_compra',
    'condicao', 'acessorios', 'garantia', 'observacoes', 'status', 'stock_quantity', 'created_at', 'updated_at',
  ]
  const values = []
  const placeholders = products.map((product, rowIndex) => {
    const offset = rowIndex * columns.length
    values.push(...columns.map((column) => product[column]))
    return `(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(', ')})`
  })

  const updateSet = columns
    .filter((column) => !['id', 'created_at'].includes(column))
    .map((column) => `${column} = excluded.${column}`)
    .join(', ')

  await client.query(`
    insert into public.sale_devices (${columns.join(', ')})
    values ${placeholders.join(',\n')}
    on conflict (id) do update set ${updateSet}
  `, values)
}

function buildSupabaseDbUrl() {
  const ref = process.env.SUPABASE_PROJECT_REF || ''
  const password = process.env.SUPABASE_DB_PASSWORD || ''
  if (!ref || !password) return ''
  return `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function uuidFromName(name) {
  const namespace = Buffer.from(PRODUCT_NAMESPACE.replace(/-/g, ''), 'hex')
  const hash = crypto.createHash('sha1').update(namespace).update(name).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function categoryLabel(category) {
  const labels = {
    celular: 'Celular',
    carregador: 'Carregador',
    pelicula: 'Pelicula',
    capa: 'Capa',
    acessorio: 'Acessorio',
    outro: 'Outro',
  }
  return labels[category] || 'Outro'
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1
    return acc
  }, {})
}

function parseBrazilianNumber(value) {
  const cleaned = clean(value)
  if (!cleaned) return 0
  const normalized = cleaned.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function onlyMeaningfulCode(value) {
  const cleaned = clean(value)
  if (!cleaned || cleaned === '0') return null
  return cleaned
}

function titleCase(value) {
  return normalizeSpaces(value)
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
}

function formatNumber(value) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function normalize(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeSpaces(value) {
  return clean(value).replace(/\s+/g, ' ').trim()
}

function clean(value) {
  return String(value ?? '').replace(/\t/g, '').trim()
}
