// ═══════════════════════════════════════════════════════════════
// Impressao da OS de entrada — 2 vias em uma folha A4
//
// Layout exclusivo de impressao (sem elementos da interface),
// no estilo do comprovante FPQ que a equipe ja conhece:
// cabecalho da empresa, dados da OS, cliente, aparelho, defeito,
// condicoes de servico, assinaturas. Via do cliente + via da
// assistencia separadas por linha de corte.
//
// Usa iframe oculto + window.print() — nao navega, nao abre popup.
// ═══════════════════════════════════════════════════════════════

import type { AppSettings, ChecklistItem, ServiceOrder } from '@/types/database'
import { STATUS_CONFIG, brl } from '@/lib/constants'
import { getOsConfig, type OsConfig } from '@/lib/os-config'

export interface PrintChecklist {
  itens: ChecklistItem
  observacoes?: string | null
}

function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso)
  date.setDate(date.getDate() + days)
  return fmtDate(date.toISOString())
}

function enderecoCliente(order: ServiceOrder): string {
  const c = order.customer
  if (!c) return ''
  const linha = [c.logradouro, c.numero].filter(Boolean).join(', ')
  const cidade = [c.bairro, c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade].filter(Boolean).join(' - ')
  return [linha, c.complemento, cidade, c.cep ? `CEP ${c.cep}` : ''].filter(Boolean).join(' · ')
}

function checklistHtml(config: OsConfig, checklist?: PrintChecklist | null): string {
  if (!config.printChecklist || !checklist || Object.keys(checklist.itens).length === 0) return ''

  const itens = Object.entries(checklist.itens)
    .map(([nome, ok]) => `<span class="chk ${ok ? '' : 'nok'}">${ok ? '&#10003;' : '&#10007;'} ${esc(nome)}</span>`)
    .join('')

  return `
    <div class="bloco">
      <p class="titulo">CHECKLIST DE ENTRADA:</p>
      <div class="chk-grid">${itens}</div>
      ${checklist.observacoes ? `<p class="texto chk-obs"><b>Obs:</b> ${esc(checklist.observacoes)}</p>` : ''}
    </div>`
}

function viaHtml(order: ServiceOrder, settings: AppSettings, config: OsConfig, viaLabel: string, checklist?: PrintChecklist | null): string {
  const aparelho = [order.device?.marca, order.device?.modelo].filter(Boolean).join(' ') || '—'
  const acessorios = order.device?.acessorios?.length ? order.device.acessorios.join(', ') : 'Nenhum'
  const endereco = enderecoCliente(order)
  const previsao = addDays(order.created_at, config.defaultDeadlineDays)
  const condicoes = settings.os_entry_terms || ''
  const garantia = settings.warranty_terms || ''
  const mostrarValor = config.printShowValues && order.valor_servico > 0
  const contato = [config.companyPhone, config.companyEmail].filter(Boolean).join(' · ')

  return `
  <section class="via">
    <div class="via-tag">${esc(viaLabel)}</div>
    <header>
      <div class="empresa">
        <h1>${esc(config.companyName)}</h1>
        <p>${esc(config.companyAddress)}</p>
        ${contato ? `<p>${esc(contato)}</p>` : ''}
        ${config.companyCnpj ? `<p>CNPJ: ${esc(config.companyCnpj)}</p>` : ''}
      </div>
      <div class="os-id">
        <h2>COMPROVANTE DE ENTRADA — OS Nº ${esc(order.numero)}</h2>
        <p>Data: ${fmtDate(order.created_at)} &nbsp; Hora: ${fmtTime(order.created_at)} &nbsp; Situacao: ${esc(STATUS_CONFIG[order.status]?.label || order.status)}</p>
      </div>
    </header>

    <div class="bloco">
      <div class="linha">
        <span><b>Cliente:</b> ${esc(order.customer?.nome || '—')}</span>
        <span><b>Tel:</b> ${esc(order.customer?.telefone || '—')}</span>
        ${order.customer?.cpf ? `<span><b>CPF:</b> ${esc(order.customer.cpf)}</span>` : ''}
      </div>
      ${endereco ? `<div class="linha"><span><b>Endereco:</b> ${esc(endereco)}</span></div>` : ''}
    </div>

    <div class="bloco">
      <div class="linha">
        <span><b>Aparelho:</b> ${esc(aparelho)}</span>
        <span><b>Cor:</b> ${esc(order.device?.cor || '—')}</span>
        ${order.device?.imei ? `<span><b>IMEI:</b> ${esc(order.device.imei)}</span>` : ''}
      </div>
      ${(order.device?.senha_desbloqueio || order.device?.senha_padrao) ? `<div class="linha">
        ${order.device?.senha_desbloqueio ? `<span><b>Senha / PIN:</b> ${esc(order.device.senha_desbloqueio)}</span>` : ''}
        ${order.device?.senha_padrao ? `<span><b>Padrao:</b> ${esc(order.device.senha_padrao.split('-').join(' -> '))}</span>` : ''}
      </div>` : ''}
      <div class="linha"><span><b>Acessorios:</b> ${esc(acessorios)}</span></div>
    </div>

    <div class="bloco">
      <p class="titulo">PROBLEMA INFORMADO:</p>
      <p class="texto">${esc(order.problema_relatado || '—').replace(/\n/g, '<br/>')}</p>
    </div>

    ${checklistHtml(config, checklist)}

    ${mostrarValor ? `
    <div class="bloco">
      <div class="linha">
        <span><b>Valor do servico:</b> ${brl(order.valor_servico)}</span>
        ${order.garantia_dias > 0 ? `<span><b>Garantia:</b> ${order.garantia_dias} dias</span>` : ''}
        <span><b>Previsao de entrega:</b> ${previsao}</span>
      </div>
    </div>` : `
    <div class="bloco">
      <div class="linha"><span><b>Previsao de entrega:</b> ${previsao}</span></div>
    </div>`}

    <div class="bloco condicoes">
      <p class="titulo">CONDICOES DE SERVICO:</p>
      <p class="texto">${esc(condicoes).replace(/\n/g, '<br/>')}</p>
      ${garantia ? `<p class="texto">${esc(garantia).replace(/\n/g, '<br/>')}</p>` : ''}
    </div>

    <footer>
      <div class="assinatura"><span>Assinatura do cliente</span></div>
      <div class="assinatura"><span>Visto: ${esc(config.companyName)}</span></div>
    </footer>
    ${config.companyFooter ? `<p class="rodape">${esc(config.companyFooter)}</p>` : ''}
  </section>`
}

export function buildEntradaHtml(order: ServiceOrder, settings: AppSettings, config: OsConfig = getOsConfig(), checklist?: PrintChecklist | null): string {
  const vias = config.printTwoVias
    ? viaHtml(order, settings, config, 'VIA DO CLIENTE', checklist) +
      '<div class="corte"><span>✂ — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — corte aqui</span></div>' +
      viaHtml(order, settings, config, 'VIA DA ASSISTENCIA', checklist)
    : viaHtml(order, settings, config, 'VIA UNICA', checklist)

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>OS ${esc(order.numero)} — Entrada</title>
<style>
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; line-height: 1.35; }
  .via { padding: 4mm 0 2mm; page-break-inside: avoid; }
  .via-tag { text-align: right; font-size: 9px; font-weight: bold; letter-spacing: 1px; color: #555; margin-bottom: 2mm; }
  header { display: flex; justify-content: space-between; gap: 6mm; border-bottom: 2px solid #111; padding-bottom: 2mm; margin-bottom: 2mm; }
  .empresa h1 { font-size: 14px; }
  .empresa p { font-size: 9px; color: #333; }
  .os-id { text-align: right; }
  .os-id h2 { font-size: 12px; }
  .os-id p { font-size: 9.5px; color: #333; margin-top: 1mm; }
  .bloco { border-bottom: 1px solid #999; padding: 1.6mm 0; }
  .linha { display: flex; flex-wrap: wrap; gap: 2mm 8mm; }
  .titulo { font-weight: bold; font-size: 10px; margin-bottom: 1mm; }
  .texto { white-space: normal; }
  .condicoes .texto { font-size: 9px; color: #222; margin-bottom: 1mm; }
  footer { display: flex; justify-content: space-between; gap: 10mm; margin-top: 6mm; }
  .assinatura { flex: 1; border-top: 1px solid #111; padding-top: 1.5mm; text-align: center; font-size: 9px; color: #333; }
  .rodape { text-align: center; font-size: 8.5px; color: #555; margin-top: 2mm; }
  .corte { text-align: center; color: #777; font-size: 9px; padding: 3mm 0; border: 0; }
  .chk-grid { display: flex; flex-wrap: wrap; gap: 0.8mm 2.4mm; }
  .chk { font-size: 8px; color: #14532d; white-space: nowrap; }
  .chk.nok { color: #7f1d1d; font-weight: bold; }
  .chk-obs { font-size: 8.5px; margin-top: 1mm; }
  .print-actions { position: sticky; top: 0; z-index: 10; padding: 12px; text-align: center; background: #fff; }
  .print-actions button { border: 0; border-radius: 8px; padding: 12px 20px; background: #d71920; color: #fff; font-weight: bold; font-size: 14px; }
  @media print { .print-actions { display: none; } }
</style>
</head>
<body>
  <div class="print-actions"><button type="button" onclick="window.print()">Imprimir / salvar PDF</button></div>
  ${vias}
</body>
</html>`
}

export function printEntradaA4(
  order: ServiceOrder,
  settings: AppSettings,
  config: OsConfig = getOsConfig(),
  checklist?: PrintChecklist | null,
  preview?: Window | null,
): void {
  const html = buildEntradaHtml(order, settings, config, checklist)
  const mobile = window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches

  if (mobile) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    if (preview) {
      preview.location.href = url
    } else {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
    return
  }

  preview?.close()

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Nao foi possivel preparar a impressao')
  }

  doc.open()
  doc.write(html)
  doc.close()

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe)
  }

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      // Da tempo do dialogo abrir antes de remover o iframe
      setTimeout(cleanup, 60_000)
    }
  }
}
