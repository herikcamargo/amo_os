/* eslint-disable react/only-export-components */
import {
  Document, Page, Text, View, StyleSheet, pdf,
} from '@react-pdf/renderer'
import type { AppSettings, DeviceSale, ServiceOrder } from '@/types/database'
import { CHECK_ENTRADA, CHECK_SAIDA, brl } from '@/lib/constants'

export type OsPrintKind = 'entrada' | 'saida'

const red = '#D71920'
const black = '#090909'
const line = '#D7D7D7'

const styles = StyleSheet.create({
  page: { padding: 18, fontSize: 8.4, fontFamily: 'Helvetica', color: '#111' },
  top: { backgroundColor: black, color: '#fff', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  logoRed: { color: red },
  sub: { fontSize: 7.5, marginTop: 3, color: '#ddd' },
  contact: { fontSize: 7.5, lineHeight: 1.35, textAlign: 'right' },
  redLine: { height: 3, backgroundColor: red, marginBottom: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  badge: { backgroundColor: red, color: '#fff', paddingHorizontal: 8, paddingVertical: 4, marginTop: 3, alignSelf: 'flex-start', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  osBox: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 7, minWidth: 135 },
  osNumber: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  osRed: { color: red },
  osDate: { fontSize: 7.5, marginTop: 5, textAlign: 'center' },
  section: { marginBottom: 7 },
  sectionTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: line },
  grid2: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingVertical: 2.4 },
  label: { width: '34%', color: '#555', fontSize: 7.4 },
  value: { width: '66%', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  box: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 6, minHeight: 30 },
  boxText: { lineHeight: 1.32 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: line },
  checkItem: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 2.2, paddingHorizontal: 4, borderBottomWidth: 0.4, borderBottomColor: '#eee' },
  check: { width: 9, height: 9, borderWidth: 1, borderColor: '#999', marginRight: 4, textAlign: 'center', fontSize: 6 },
  ok: { color: '#16823A', borderColor: '#16823A' },
  fail: { color: red, borderColor: red },
  terms: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 6, lineHeight: 1.24, fontSize: 7.2 },
  declaration: { backgroundColor: '#F6F6F6', borderRadius: 4, padding: 6, lineHeight: 1.25, fontSize: 7.4 },
  signatures: { flexDirection: 'row', gap: 12, marginTop: 10 },
  sign: { flex: 1, borderWidth: 1, borderColor: line, borderRadius: 4, paddingTop: 22, paddingBottom: 5 },
  signLine: { borderTopWidth: 1, borderTopColor: '#333', marginHorizontal: 12, paddingTop: 4, textAlign: 'center', fontSize: 7 },
  footer: { position: 'absolute', left: 18, right: 18, bottom: 12, backgroundColor: black, color: '#fff', padding: 7, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7 },
})

function address(order: ServiceOrder) {
  return [
    order.customer?.logradouro,
    order.customer?.numero,
    order.customer?.bairro,
    order.customer?.cidade && order.customer?.uf ? `${order.customer.cidade}/${order.customer.uf}` : order.customer?.cidade,
  ].filter(Boolean).join(', ') || '--'
}

function serviceWarrantyEnd(order: ServiceOrder) {
  if (!order.garantia_dias) return '--'
  const d = new Date()
  d.setDate(d.getDate() + order.garantia_dias)
  return d.toLocaleDateString('pt-BR')
}

function TermsText({ text }: { text?: string }) {
  const items = (text || '').split('\n').map((lineItem) => lineItem.trim()).filter(Boolean)
  return (
    <View style={styles.terms}>
      {items.length ? items.slice(0, 5).map((item) => <Text key={item}>- {item}</Text>) : <Text>Termos nao configurados.</Text>}
    </View>
  )
}

function Checklist({ kind }: { kind: OsPrintKind }) {
  const items = (kind === 'saida' ? CHECK_SAIDA : CHECK_ENTRADA).slice(0, 12)
  return (
    <View style={styles.checkGrid}>
      {items.map((item, index) => {
        const ok = kind === 'saida' || index % 5 !== 0
        return (
          <View key={item} style={styles.checkItem}>
            <Text style={[styles.check, ok ? styles.ok : styles.fail]}>{ok ? '✓' : '×'}</Text>
            <Text>{item}: {ok ? 'Funcionando' : 'Com defeito'}</Text>
          </View>
        )
      })}
    </View>
  )
}

function Header({ order, kind }: { order: ServiceOrder; kind: OsPrintKind }) {
  return (
    <>
      <View style={styles.top}>
        <View>
          <Text style={styles.logo}>Amo<Text style={styles.logoRed}>Celular</Text>♥</Text>
          <Text style={styles.sub}>Assistencia tecnica especializada</Text>
        </View>
        <Text style={styles.contact}>
          (16) 3333-4444{'\n'}(16) 99999-8888{'\n'}@amo_celular{'\n'}amocelular.com.br
        </Text>
      </View>
      <View style={styles.redLine} />
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>ORDEM DE SERVICO</Text>
          <Text style={styles.badge}>{kind === 'entrada' ? 'OS DE ENTRADA' : 'OS DE SAIDA'}</Text>
        </View>
        <View style={styles.osBox}>
          <Text style={styles.osNumber}>N OS: <Text style={styles.osRed}>{order.numero}</Text></Text>
          <Text style={styles.osDate}>{kind === 'entrada' ? 'Data' : 'Conclusao'}: {new Date().toLocaleString('pt-BR')}</Text>
        </View>
      </View>
    </>
  )
}

function ClientAndDevice({ order }: { order: ServiceOrder }) {
  const unlockType = order.device?.tipo_desbloqueio || (order.device?.senha_padrao ? 'padrao' : 'senha_pin')
  return (
    <View style={styles.grid2}>
      <View style={styles.col}>
        <Text style={styles.sectionTitle}>DADOS DO CLIENTE</Text>
        <View style={styles.row}><Text style={styles.label}>Nome</Text><Text style={styles.value}>{order.customer?.nome || '--'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Telefone</Text><Text style={styles.value}>{order.customer?.telefone || '--'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>CPF</Text><Text style={styles.value}>{order.customer?.cpf || '--'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Endereco</Text><Text style={styles.value}>{address(order)}</Text></View>
      </View>
      <View style={styles.col}>
        <Text style={styles.sectionTitle}>DADOS DO APARELHO</Text>
        <View style={styles.row}><Text style={styles.label}>Modelo</Text><Text style={styles.value}>{order.device?.marca} {order.device?.modelo}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Cor</Text><Text style={styles.value}>{order.device?.cor || '--'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>IMEI</Text><Text style={styles.value}>{order.device?.imei || '--'}</Text></View>
        {unlockType === 'senha_pin' && order.device?.senha_desbloqueio && <View style={styles.row}><Text style={styles.label}>Senha / PIN</Text><Text style={styles.value}>{order.device.senha_desbloqueio}</Text></View>}
        {unlockType === 'padrao' && order.device?.senha_padrao && <View style={styles.row}><Text style={styles.label}>Padrao</Text><Text style={styles.value}>{order.device.senha_padrao.split('-').join(' -> ')}</Text></View>}
        <View style={styles.row}><Text style={styles.label}>Acessorios</Text><Text style={styles.value}>{order.device?.acessorios?.join(', ') || 'Nenhum'}</Text></View>
      </View>
    </View>
  )
}

function OsPdfDocument({ order, kind = 'entrada', settings }: { order: ServiceOrder; kind?: OsPrintKind; settings?: AppSettings }) {
  const isSaida = kind === 'saida'
  const entryTerms = settings?.os_entry_terms || 'Cliente autoriza analise tecnica e orcamento do aparelho.'
  const exitTerms = settings?.os_exit_terms || 'Cliente conferiu o aparelho e esta de acordo com a entrega.'
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header order={order} kind={kind} />
        <View style={styles.section}><ClientAndDevice order={order} /></View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isSaida ? 'INFORMACOES DO SERVICO' : 'PROBLEMA INFORMADO PELO CLIENTE'}</Text>
          <View style={styles.box}>
            <Text style={styles.boxText}>{order.problema_relatado || '--'}</Text>
            {isSaida && <Text style={styles.boxText}>Servico realizado: {order.servico_executado || order.diagnostico || '--'}</Text>}
            {isSaida && <Text style={styles.boxText}>Pecas: {order.part_warranty?.description || order.pecas_utilizadas || '--'}</Text>}
          </View>
        </View>

        {isSaida && (
          <View style={styles.grid2}>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>PAGAMENTO</Text>
              <View style={styles.row}><Text style={styles.label}>Valor</Text><Text style={styles.value}>{brl(order.valor_servico || 0)}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Forma</Text><Text style={styles.value}>{order.payment_method || 'A preencher'}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Situacao</Text><Text style={styles.value}>{order.payment_status || 'A preencher'}</Text></View>
            </View>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>GARANTIA</Text>
              <View style={styles.row}><Text style={styles.label}>Prazo</Text><Text style={styles.value}>{order.garantia_dias || 0} dias</Text></View>
              <View style={styles.row}><Text style={styles.label}>Final</Text><Text style={styles.value}>{serviceWarrantyEnd(order)}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Retirado por</Text><Text style={styles.value}>{order.delivery_receiver || order.delivery_responsible || '--'}</Text></View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isSaida ? 'CHECKLIST DE SAIDA' : 'CHECKLIST DE RECEBIMENTO'}</Text>
          <Checklist kind={kind} />
        </View>

        <View style={styles.grid2}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>{isSaida ? 'TERMOS DE SERVICO' : 'TERMOS DA ENTRADA'}</Text>
            <TermsText text={isSaida ? exitTerms : entryTerms} />
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>{isSaida ? 'TERMOS DE GARANTIA' : 'OBSERVACOES'}</Text>
            <TermsText text={isSaida ? settings?.warranty_terms : order.delivery_notes || order.condicao_estetica?.descricao || 'Aparelho recebido para analise e orcamento.'} />
          </View>
        </View>

        {isSaida && (
          <View style={[styles.section, { marginTop: 7 }]}>
            <Text style={styles.declaration}>
              Declaro que recebi o aparelho acima identificado, tive a oportunidade de conferir seu funcionamento e estou de acordo com os servicos realizados, condicoes de entrega e termos de garantia apresentados neste documento.
            </Text>
          </View>
        )}

        <View style={styles.signatures}>
          <View style={styles.sign}><Text style={styles.signLine}>Cliente</Text></View>
          <View style={styles.sign}><Text style={styles.signLine}>{isSaida ? 'Entregue por' : 'Recebido por'}</Text></View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Rua Sao Bento, 1548 - Centro - Araraquara/SP</Text>
          <Text style={styles.footerText}>Pensou em arrumar, pensou AmoCelular.</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateOsPdf(order: ServiceOrder, kind: OsPrintKind = 'entrada', settings?: AppSettings): Promise<Blob> {
  return pdf(<OsPdfDocument order={order} kind={kind} settings={settings} />).toBlob()
}

export async function openOsPdf(
  order: ServiceOrder,
  kind: OsPrintKind = 'entrada',
  settings?: AppSettings,
  preview?: Window | null,
) {
  try {
    const blob = await generateOsPdf(order, kind, settings)
    const url = URL.createObjectURL(blob)
    if (preview && !preview.closed) {
      preview.location.href = url
      window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
      return
    }
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener'
    anchor.download = `${order.numero}-${kind}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    preview?.close()
    throw error
  }
}

function SaleReceiptDocument({ sale }: { sale: DeviceSale }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header order={{
          id: sale.id,
          numero: sale.numero,
          customer_id: sale.customer_id,
          device_id: sale.device_id,
          status: 'entregue',
          problema_relatado: 'Venda de produto',
          condicao_estetica: {},
          valor_servico: sale.valor_final,
          garantia_dias: 0,
          created_by: sale.seller_id,
          created_at: sale.sold_at,
          updated_at: sale.sold_at,
          customer: sale.customer,
        }} kind="saida" />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECIBO DE VENDA</Text>
          <View style={styles.row}><Text style={styles.label}>Produto</Text><Text style={styles.value}>{sale.device?.marca} {sale.device?.modelo}</Text></View>
          <View style={styles.row}><Text style={styles.label}>IMEI/Serie</Text><Text style={styles.value}>{sale.device?.imei1 || sale.device?.serial || sale.device?.sku || '--'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Quantidade</Text><Text style={styles.value}>{sale.quantity || 1}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Valor</Text><Text style={styles.value}>{brl(sale.valor_final)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Pagamento</Text><Text style={styles.value}>{sale.forma_pagamento} - {sale.parcelas}x</Text></View>
        </View>
        <View style={styles.signatures}>
          <View style={styles.sign}><Text style={styles.signLine}>Cliente</Text></View>
          <View style={styles.sign}><Text style={styles.signLine}>Responsavel pela loja</Text></View>
        </View>
      </Page>
    </Document>
  )
}

export function downloadSaleReceiptPdf(sale: DeviceSale) {
  pdf(<SaleReceiptDocument sale={sale} />).toBlob().then((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sale.numero}-recibo.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}
