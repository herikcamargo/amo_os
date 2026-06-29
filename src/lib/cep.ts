export interface CepAddress {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

export function maskCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function isValidCep(value: string) {
  return value.replace(/\D/g, '').length === 8
}

export async function lookupCep(value: string): Promise<CepAddress> {
  const cep = value.replace(/\D/g, '')
  if (cep.length !== 8) throw new Error('CEP invalido')

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  if (!response.ok) throw new Error('Servico de CEP indisponivel')

  const data = await response.json() as ViaCepResponse
  if (data.erro) throw new Error('CEP nao encontrado')

  return {
    cep: maskCep(data.cep || cep),
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    cidade: data.localidade || '',
    uf: data.uf || '',
  }
}
