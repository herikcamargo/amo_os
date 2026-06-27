import { MARCAS, MODELOS_POR_MARCA } from './constants'

export interface ScannedOsData {
  nome?: string
  endereco?: string
  telefone?: string
  modelo?: string
  marca?: string
  problema?: string
  dataHora?: string
  rawText: string
}

export async function scanOsImage(file: File | Blob): Promise<ScannedOsData> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('por')

  try {
    const result = await worker.recognize(file)
    return parseOsText(result.data.text || '')
  } finally {
    await worker.terminate()
  }
}

export function parseOsText(rawText: string): ScannedOsData {
  const text = normalizeText(rawText)
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const telefone = firstMatch(text, [
    /(?:tel(?:efone)?|whats(?:app)?|celular)\D*((?:\+?55\D*)?\(?\d{2}\)?\D*9?\d{4}\D*\d{4})/i,
    /((?:\+?55\D*)?\(?\d{2}\)?\D*9?\d{4}\D*\d{4})/i,
  ])

  const nome = valueAfterLabel(lines, ['nome', 'cliente', 'proprietario']) || guessName(lines)
  const endereco = valueAfterLabel(lines, ['endereco', 'endereço', 'rua', 'avenida', 'av'])
  const problema = valueAfterLabel(lines, ['problema', 'defeito', 'relato', 'observacao', 'observação'])
  const dataHora = firstMatch(text, [
    /(\d{2}\/\d{2}\/\d{2,4}\s+\d{2}:\d{2})/,
    /(\d{2}\/\d{2}\/\d{2,4})/,
  ])
  const modelo = findModel(text)
  const marca = modelo ? findBrandByModel(modelo) : findBrand(text)

  return {
    nome,
    endereco,
    telefone: telefone ? cleanPhone(telefone) : undefined,
    modelo,
    marca,
    problema,
    dataHora,
    rawText,
  }
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[|]/g, ' ')
    .replace(/[ \t]+/g, ' ')
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return undefined
}

function valueAfterLabel(lines: string[], labels: string[]) {
  for (const line of lines) {
    const normalized = removeAccents(line).toLowerCase()
    for (const label of labels) {
      const cleanLabel = removeAccents(label).toLowerCase()
      if (normalized.startsWith(cleanLabel)) {
        const value = line.split(/:|-/).slice(1).join('-').trim()
        if (value.length > 2) return value
      }
    }
  }
  return undefined
}

function guessName(lines: string[]) {
  const ignored = ['ordem', 'os', 'telefone', 'whatsapp', 'endereco', 'modelo', 'aparelho', 'problema', 'defeito']
  return lines.find((line) => {
    const clean = removeAccents(line).toLowerCase()
    return line.length > 5
      && line.length < 60
      && !ignored.some((word) => clean.includes(word))
      && /[a-zA-Z]{3,}\s+[a-zA-Z]{2,}/.test(line)
  })
}

function findModel(text: string) {
  const lower = removeAccents(text).toLowerCase()
  for (const models of Object.values(MODELOS_POR_MARCA)) {
    for (const model of models) {
      if (lower.includes(removeAccents(model).toLowerCase())) return model
    }
  }

  const fallback = text.match(/(?:modelo|aparelho|celular)\D*([a-z0-9 ]{3,35})/i)
  return fallback?.[1]?.trim()
}

function findBrand(text: string) {
  const lower = removeAccents(text).toLowerCase()
  return MARCAS.find((brand) => lower.includes(removeAccents(brand).toLowerCase()))
}

function findBrandByModel(model: string) {
  return Object.entries(MODELOS_POR_MARCA).find(([, models]) => models.includes(model))?.[0]
}

function cleanPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  if (digits.length === 13 && digits.startsWith('55')) return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  return value.trim()
}

function removeAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
