import {
  Document, Page, Text, View, StyleSheet, pdf, Font,
} from '@react-pdf/renderer'
import type { ServiceOrder } from '@/types/database'
import { STATUS_CONFIG, CHECK_ENTRADA, brl } from '@/lib/constants'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica', color: '#222' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#D71920', paddingBottom: 12 },
  logo: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  logoRed: { color: '#D71920' },
  subtitle: { fontSize: 7, color: '#888', letterSpacing: 2, marginTop: 2 },
  osNumber: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  osDate: { fontSize: 9, color: '#666', textAlign: 'right', marginTop: 2 },

  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#D71920', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  label: { width: '35%', color: '#666' },
  value: { width: '65%', fontFamily: 'Helvetica-Bold' },

  checkGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  checkItem: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  checkMark: { width: 12, height: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 2, marginRight: 6, textAlign: 'center', fontSize: 8, lineHeight: 1.4 },
  checkOk: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50', color: '#2E7D32' },
  checkFail: { backgroundColor: '#FFEBEE', borderColor: '#F44336', color: '#C62828' },

  problema: { padding: 8, backgroundColor: '#F5F5F5', borderRadius: 4, lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#999' },

  signatureSection: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBox: { width: '45%', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 6 },
  signatureLabel: { fontSize: 9, color: '#666', textAlign: 'center' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  garantia: { padding: 10, backgroundColor: '#FFF8E1', borderRadius: 4, borderWidth: 1, borderColor: '#FFD54F', marginTop: 4 },
})

interface Props {
  order: ServiceOrder
}

function OsPdfDocument({ order }: Props) {
  const st = STATUS_CONFIG[order.status]
  const data = new Date(order.created_at).toLocaleDateString('pt-BR')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              Amo<Text style={styles.logoRed}>Celular</Text>
            </Text>
            <Text style={styles.subtitle}>ASSISTÊNCIA TÉCNICA</Text>
            <Text style={{ fontSize: 8, color: '#888', marginTop: 4 }}>Araraquara/SP</Text>
          </View>
          <View>
            <Text style={styles.osNumber}>{order.numero}</Text>
            <Text style={styles.osDate}>Data: {data}</Text>
            <View style={[styles.statusBadge, { backgroundColor: st.dot + '22', marginTop: 4 }]}>
              <Text style={{ color: st.dot }}>{st.label}</Text>
            </View>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{order.customer?.nome || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefone</Text>
            <Text style={styles.value}>{order.customer?.telefone || '—'}</Text>
          </View>
          {order.customer?.cpf && (
            <View style={styles.row}>
              <Text style={styles.label}>CPF</Text>
              <Text style={styles.value}>{order.customer.cpf}</Text>
            </View>
          )}
        </View>

        {/* Aparelho */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aparelho</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Marca / Modelo</Text>
            <Text style={styles.value}>{order.device?.marca} {order.device?.modelo}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cor</Text>
            <Text style={styles.value}>{order.device?.cor || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>IMEI</Text>
            <Text style={[styles.value, { fontFamily: 'Courier' }]}>{order.device?.imei || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Acessórios</Text>
            <Text style={styles.value}>
              {order.device?.acessorios?.length ? order.device.acessorios.join(', ') : 'Nenhum'}
            </Text>
          </View>
        </View>

        {/* Problema */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Problema Relatado</Text>
          <View style={styles.problema}>
            <Text>{order.problema_relatado || '—'}</Text>
          </View>
        </View>

        {/* Checklist de entrada */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist de Entrada</Text>
          <View style={styles.checkGrid}>
            {CHECK_ENTRADA.map((item, i) => {
              const ok = i % 4 !== 0
              return (
                <View key={item} style={styles.checkItem}>
                  <View style={[styles.checkMark, ok ? styles.checkOk : styles.checkFail]}>
                    <Text>{ok ? '✓' : '✕'}</Text>
                  </View>
                  <Text>{item}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Serviço & Garantia */}
        {(order.valor_servico > 0 || order.garantia_dias > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Serviço & Garantia</Text>
            {order.diagnostico && (
              <View style={styles.row}>
                <Text style={styles.label}>Diagnóstico</Text>
                <Text style={styles.value}>{order.diagnostico}</Text>
              </View>
            )}
            {order.servico_executado && (
              <View style={styles.row}>
                <Text style={styles.label}>Serviço executado</Text>
                <Text style={styles.value}>{order.servico_executado}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Valor</Text>
              <Text style={styles.value}>{brl(order.valor_servico)}</Text>
            </View>
            {order.garantia_dias > 0 && (
              <View style={styles.garantia}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>
                  Garantia: {order.garantia_dias} dias a partir da entrega
                </Text>
                <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>
                  A garantia cobre exclusivamente o serviço realizado e as peças substituídas.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Assinaturas */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Assinatura do cliente</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Assinatura da loja</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>AmoCelular — Assistência Técnica · Araraquara/SP</Text>
          <Text style={styles.footerText}>{order.numero} · Gerado em {new Date().toLocaleDateString('pt-BR')}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateOsPdf(order: ServiceOrder): Promise<Blob> {
  const blob = await pdf(<OsPdfDocument order={order} />).toBlob()
  return blob
}

export function downloadOsPdf(order: ServiceOrder) {
  generateOsPdf(order).then((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${order.numero}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}
