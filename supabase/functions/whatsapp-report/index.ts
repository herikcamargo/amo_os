// ═══════════════════════════════════════════════════════════════
// Edge Function: whatsapp-report
// Envia relatórios diários e semanais para admins via WhatsApp.
//
// Crons no dashboard Supabase:
//   Diário:  0 19 * * *         (todo dia às 19h)
//   Semanal: 0 10 * * 1         (segunda às 10h)
//
// Chamar com ?tipo=diario ou ?tipo=semanal
// Deploy: supabase functions deploy whatsapp-report
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || ''
const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY') || ''
const WHATSAPP_INSTANCE = Deno.env.get('WHATSAPP_INSTANCE') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
    console.log(`[DRY RUN] WhatsApp para ${phone}:\n${message}`)
    return true
  }

  const cleanPhone = phone.replace(/\D/g, '')
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/message/sendText/${WHATSAPP_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': WHATSAPP_API_KEY,
      },
      body: JSON.stringify({ number: fullPhone, text: message }),
    })
    return res.ok
  } catch (err) {
    console.error(`Erro WhatsApp ${phone}:`, err)
    return false
  }
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function buildDailyReport(): Promise<string> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // OS criadas hoje
  const { count: criadas } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayISO)

  // OS finalizadas hoje (status = entregue, updated hoje)
  const { data: entregues } = await supabase
    .from('service_orders')
    .select('valor_servico')
    .eq('status', 'entregue')
    .gte('updated_at', todayISO)

  const faturamento = entregues?.reduce((s, o) => s + (Number(o.valor_servico) || 0), 0) || 0

  // Em aberto
  const { count: abertas } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '("entregue","cancelado")')

  // Prontas para retirada
  const { count: prontas } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pronto')

  // Aguardando aprovação
  const { count: aprovacao } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aprovacao')

  // Aguardando peça
  const { count: peca } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'peca')

  const dataFormatada = today.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  })

  return [
    `📊 *AMO OS — Relatório Diário*`,
    `📅 ${dataFormatada}`,
    ``,
    `📋 *Resumo do dia:*`,
    `  • OS abertas hoje: *${criadas || 0}*`,
    `  • OS entregues hoje: *${entregues?.length || 0}*`,
    `  • Faturamento do dia: *${formatBRL(faturamento)}*`,
    ``,
    `📌 *Situação atual:*`,
    `  • Em aberto: *${abertas || 0}*`,
    `  • Prontas p/ retirada: *${prontas || 0}*`,
    `  • Aguardando aprovação: *${aprovacao || 0}*`,
    `  • Aguardando peça: *${peca || 0}*`,
    ``,
    `— AmoCelular 📱`,
  ].join('\n')
}

async function buildWeeklyReport(): Promise<string> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoISO = weekAgo.toISOString()

  // OS criadas na semana
  const { count: criadas } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgoISO)

  // OS entregues na semana
  const { data: entregues } = await supabase
    .from('service_orders')
    .select('valor_servico')
    .eq('status', 'entregue')
    .gte('updated_at', weekAgoISO)

  const faturamento = entregues?.reduce((s, o) => s + (Number(o.valor_servico) || 0), 0) || 0
  const ticketMedio = entregues && entregues.length > 0 ? faturamento / entregues.length : 0

  // OS canceladas na semana
  const { count: canceladas } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'cancelado')
    .gte('updated_at', weekAgoISO)

  // Top marcas da semana
  const { data: osSemana } = await supabase
    .from('v_service_orders')
    .select('device_marca')
    .gte('created_at', weekAgoISO)

  const marcas: Record<string, number> = {}
  osSemana?.forEach((o) => {
    const m = o.device_marca || 'Outro'
    marcas[m] = (marcas[m] || 0) + 1
  })
  const topMarcas = Object.entries(marcas)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([marca, count]) => `    ${marca}: ${count}`)
    .join('\n')

  // Em aberto total
  const { count: abertas } = await supabase
    .from('service_orders')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '("entregue","cancelado")')

  // Prontas há 7+ dias
  const { data: atrasadas } = await supabase
    .from('v_os_prontas_pendentes')
    .select('*')

  const atrasadas7 = atrasadas?.filter((o) => o.dias_pronto >= 7) || []

  const de = weekAgo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const ate = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return [
    `📊 *AMO OS — Relatório Semanal*`,
    `📅 ${de} a ${ate}`,
    ``,
    `📋 *Números da semana:*`,
    `  • OS abertas: *${criadas || 0}*`,
    `  • OS entregues: *${entregues?.length || 0}*`,
    `  • OS canceladas: *${canceladas || 0}*`,
    ``,
    `💰 *Financeiro:*`,
    `  • Faturamento: *${formatBRL(faturamento)}*`,
    `  • Ticket médio: *${formatBRL(ticketMedio)}*`,
    ``,
    `📱 *Top marcas:*`,
    topMarcas || '    Nenhuma OS na semana',
    ``,
    `📌 *Situação atual:*`,
    `  • Em aberto: *${abertas || 0}*`,
    atrasadas7.length > 0
      ? `  • ⚠️ *${atrasadas7.length} aparelho(s) pronto(s) há 7+ dias*`
      : `  • ✅ Nenhum aparelho parado`,
    ``,
    `— AmoCelular 📱`,
  ].join('\n')
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const tipo = url.searchParams.get('tipo') || 'diario'

    const report = tipo === 'semanal'
      ? await buildWeeklyReport()
      : await buildDailyReport()

    // Buscar admins
    const { data: admins } = await supabase
      .from('users')
      .select('telefone, nome')
      .eq('role', 'admin')
      .eq('ativo', true)

    const results: { admin: string; enviado: boolean }[] = []

    if (admins) {
      for (const admin of admins) {
        if (admin.telefone) {
          const sent = await sendWhatsApp(admin.telefone, report)
          results.push({ admin: admin.nome, enviado: sent })

          // Registrar log
          await supabase.from('whatsapp_report_logs').insert({
            tipo,
            destinatario: admin.telefone,
            conteudo: report,
            enviado: sent,
          })
        }
      }
    }

    return new Response(JSON.stringify({
      tipo,
      report,
      enviados: results,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro no whatsapp-report:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
