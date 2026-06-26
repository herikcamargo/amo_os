import type { OsStatus } from '@/types/database'

export const STATUS_CONFIG: Record<OsStatus, { label: string; dot: string; bg: string }> = {
  recebido:   { label: 'Recebido',             dot: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  analise:    { label: 'Em análise',            dot: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  aprovacao:  { label: 'Aguardando aprovação',  dot: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  peca:       { label: 'Aguardando peça',       dot: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  manutencao: { label: 'Em manutenção',         dot: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  pronto:     { label: 'Pronto para retirada',  dot: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  entregue:   { label: 'Entregue',              dot: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  cancelado:  { label: 'Cancelado',             dot: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
}

export const STATUS_FLOW: OsStatus[] = [
  'recebido', 'analise', 'aprovacao', 'peca', 'manutencao', 'pronto', 'entregue',
]

export const CHECK_ENTRADA = [
  'Liga', 'Carrega', 'Touch', 'Display', 'Câmera frontal', 'Câmera traseira',
  'Alto-falante', 'Microfone', 'Biometria', 'Face ID', 'Wi-Fi', 'Bluetooth',
  'Reconhece chip', 'Botões físicos', 'Vibração', 'Flash',
]

export const CHECK_SAIDA = [
  'Liga', 'Carrega', 'Touch', 'Display', 'Câmeras', 'Alto-falante',
  'Microfone', 'Wi-Fi', 'Bluetooth', 'Biometria',
  'Cliente conferiu aparelho', 'Cliente recebeu orientações',
]

export const CONDICAO_ESTETICA_LABELS: Record<string, string> = {
  tela_trincada: 'Tela trincada',
  tampa_quebrada: 'Tampa quebrada',
  arranhoes: 'Arranhões',
  amassado: 'Amassado',
  oxidacao_aparente: 'Oxidação aparente',
  pecas_faltando: 'Peças faltando',
}

export const ACESSORIOS_OPTIONS = [
  'Capinha', 'Película', 'Carregador', 'Fone de ouvido', 'Chip', 'Cartão SD', 'Outro',
]

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const MARCAS = [
  'Apple', 'Samsung', 'Motorola', 'Xiaomi', 'Realme', 'Poco',
  'OnePlus', 'LG', 'Nokia', 'Asus', 'Huawei', 'Outro',
]
