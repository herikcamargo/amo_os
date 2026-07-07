#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// AMO OS — Preparação final dos dados migrados do FPQ System
//
// Le os JSON já convertidos numa sessão anterior (customers.json,
// devices.json, service_orders.json), valida integridade referencial,
// remove o campo _legado (que não existe no schema) transformando-o
// em legacy_data, e grava os arquivos finais prontos para import.
//
// Uso:
//   node scripts/legacy-fpq/prepare.mjs --input "C:/caminho/migracao" --output "C:/caminho/migracao/final"
//
// Nao escreve nada no Supabase. Apenas prepara e valida.
// ═══════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'

const VALID_STATUSES = new Set([
  'recebido', 'analise', 'aprovacao', 'peca', 'manutencao', 'pronto', 'entregue', 'cancelado',
])

const args = process.argv.slice(2)
const inputDir = getArg('--input') || 'C:/Users/herik/Downloads/AMO_OS_dados_migrados/migracao'
const outputDir = getArg('--output') || path.join(inputDir, 'final')

function getArg(name) {
  const idx = args.indexOf(name)
  return idx >= 0 ? args[idx + 1] : null
}

function readJson(file) {
  const full = path.join(inputDir, file)
  if (!fs.existsSync(full)) throw new Error(`Arquivo nao encontrado: ${full}`)
  return JSON.parse(fs.readFileSync(full, 'utf-8'))
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// Corrige datas com hora/minuto fora do range (ex: "28:37:00" — overflow de
// campo do DBF antigo). Rola os dias/horas excedentes pra frente.
function sanitizeDate(value, fallback, issues, context) {
  if (!value) return fallback
  const direct = new Date(value)
  if (!isNaN(direct.getTime())) return direct.toISOString()

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{1,3}):(\d{1,3}):(\d{1,3})(.*)$/)
  if (match) {
    const [, datePart, hh, mm, ss, tz] = match
    let totalMinutes = parseInt(hh, 10) * 60 + parseInt(mm, 10)
    const extraSeconds = parseInt(ss, 10)
    const base = new Date(`${datePart}T00:00:00${tz || '-03:00'}`)
    if (!isNaN(base.getTime())) {
      base.setMinutes(base.getMinutes() + totalMinutes)
      base.setSeconds(base.getSeconds() + extraSeconds)
      issues.push(`${context}: data corrigida de "${value}" para "${base.toISOString()}"`)
      return base.toISOString()
    }
  }

  issues.push(`${context}: data invalida "${value}", usando fallback`)
  return fallback
}

function run() {
  console.log('\n  AMO OS — Preparando dados legados do FPQ System\n')
  console.log(`  Origem: ${inputDir}`)
  console.log(`  Destino: ${outputDir}\n`)

  const rawCustomers = readJson('customers.json')
  const rawDevices = readJson('devices.json')
  const rawOrders = readJson('service_orders.json')

  const issues = []

  // ───── Customers ─────
  const customerIds = new Set()
  const customers = []
  let customersSemTelefone = 0
  for (const c of rawCustomers) {
    if (!isUuid(c.id)) { issues.push(`customer com id invalido: ${JSON.stringify(c).slice(0, 100)}`); continue }
    if (customerIds.has(c.id)) { issues.push(`customer id duplicado: ${c.id}`); continue }
    if (!c.nome || !c.nome.trim()) { issues.push(`customer sem nome, pulado: ${c.id}`); continue }
    customerIds.add(c.id)
    if (!c.telefone) customersSemTelefone++
    customers.push({
      id: c.id,
      nome: c.nome.trim(),
      telefone: c.telefone || '',
      cpf: c.cpf || null,
      cep: c.cep || null,
      logradouro: c.logradouro || null,
      numero: c.numero || null,
      complemento: c.complemento || null,
      bairro: c.bairro || null,
      cidade: c.cidade || null,
      uf: c.uf || null,
      created_at: sanitizeDate(c.created_at, new Date().toISOString(), issues, `customer ${c.id}`),
      legacy_system: 'fpq',
      legacy_cod: c.old_cod != null ? String(c.old_cod) : null,
    })
  }

  // ───── Devices ─────
  const deviceIds = new Set()
  const devices = []
  for (const d of rawDevices) {
    if (!isUuid(d.id)) { issues.push(`device com id invalido: ${JSON.stringify(d).slice(0, 100)}`); continue }
    if (deviceIds.has(d.id)) { issues.push(`device id duplicado: ${d.id}`); continue }
    if (!customerIds.has(d.customer_id)) { issues.push(`device ${d.id} aponta pra customer inexistente ${d.customer_id}, pulado`); continue }
    deviceIds.add(d.id)
    devices.push({
      id: d.id,
      customer_id: d.customer_id,
      marca: d.marca || null,
      modelo: d.modelo || null,
      cor: d.cor || null,
      imei: d.imei || null,
      senha_desbloqueio: d.senha_desbloqueio || null,
      acessorios: Array.isArray(d.acessorios) ? d.acessorios : [],
      created_at: sanitizeDate(d.created_at, new Date().toISOString(), issues, `device ${d.id}`),
    })
  }

  // ───── Service Orders ─────
  const numeros = new Set()
  const orders = []
  const statusCount = {}
  for (const o of rawOrders) {
    if (!isUuid(o.id)) { issues.push(`order com id invalido: ${JSON.stringify(o).slice(0, 100)}`); continue }
    if (!o.numero || numeros.has(o.numero)) { issues.push(`order numero invalido/duplicado: ${o.numero}, pulado`); continue }
    if (!customerIds.has(o.customer_id)) { issues.push(`order ${o.numero} aponta pra customer inexistente, pulado`); continue }
    if (!deviceIds.has(o.device_id)) { issues.push(`order ${o.numero} aponta pra device inexistente, pulado`); continue }
    const status = VALID_STATUSES.has(o.status) ? o.status : 'recebido'
    if (status !== o.status) issues.push(`order ${o.numero} com status invalido "${o.status}", convertido para "recebido"`)
    numeros.add(o.numero)
    statusCount[status] = (statusCount[status] || 0) + 1

    const legacyData = o._legado ? {
      numero_antigo: o._legado.numero_antigo ?? null,
      tecnico: o._legado.tecnico ?? null,
      situacao_antiga: o._legado.situacao_antiga ?? null,
      motivo: o._legado.motivo ?? null,
    } : null

    orders.push({
      id: o.id,
      numero: o.numero,
      customer_id: o.customer_id,
      device_id: o.device_id,
      status,
      problema_relatado: o.problema_relatado || '',
      condicao_estetica: o.condicao_estetica || {},
      diagnostico: o.diagnostico || null,
      servico_executado: o.servico_executado || null,
      pecas_utilizadas: o.pecas_utilizadas || null,
      valor_servico: Number.isFinite(o.valor_servico) ? o.valor_servico : 0,
      garantia_dias: Number.isFinite(o.garantia_dias) ? o.garantia_dias : 0,
      created_by: null,
      created_at: sanitizeDate(o.created_at, new Date().toISOString(), issues, `order ${o.numero} created_at`),
      updated_at: sanitizeDate(o.updated_at || o.created_at, new Date().toISOString(), issues, `order ${o.numero} updated_at`),
      payment_method: o.payment_method || null,
      payment_status: o.payment_status || null,
      legacy_system: 'fpq',
      legacy_data: legacyData,
    })
  }

  // ───── Write output ─────
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, 'customers.json'), JSON.stringify(customers, null, 2))
  fs.writeFileSync(path.join(outputDir, 'devices.json'), JSON.stringify(devices, null, 2))
  fs.writeFileSync(path.join(outputDir, 'service_orders.json'), JSON.stringify(orders, null, 2))

  const report = [
    'RELATORIO DE PREPARACAO — FPQ System -> AMO OS (final, pronto para import)',
    '='.repeat(70),
    '',
    `Clientes de entrada: ${rawCustomers.length}`,
    `Clientes validos: ${customers.length}`,
    `Clientes sem telefone: ${customersSemTelefone}`,
    '',
    `Aparelhos de entrada: ${rawDevices.length}`,
    `Aparelhos validos: ${devices.length}`,
    '',
    `Ordens de entrada: ${rawOrders.length}`,
    `Ordens validas: ${orders.length}`,
    '',
    'Distribuicao de status:',
    ...Object.entries(statusCount).sort((a, b) => b[1] - a[1]).map(([s, n]) => `  ${s}: ${n}`),
    '',
    `Problemas encontrados (${issues.length}):`,
    ...issues.slice(0, 200).map((i) => `  - ${i}`),
    issues.length > 200 ? `  ... e mais ${issues.length - 200} (truncado)` : '',
  ].filter((line) => line !== undefined).join('\n')

  fs.writeFileSync(path.join(outputDir, '_RELATORIO_PREPARACAO.txt'), report)
  console.log(report)
  console.log(`\n  Arquivos finais gravados em: ${outputDir}\n`)
}

run()
