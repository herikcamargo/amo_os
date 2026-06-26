// ═══════════════════════════════════════════════════════════════
// Edge Function: check-reminders
// Roda via cron (Supabase) a cada 6 horas.
// Verifica OS com status "pronto" há 3+ dias e gera alertas.
// Se >= 7 dias, envia WhatsApp para o cliente automaticamente.
// ═══════════════════════════════════════════════════════════════
// Deploy: supabase functions deploy check-reminders
// Cron (no dashboard Supabase): 0 */6 * * *
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') || ''
const WHATSAPP_API_KEY = Deno.env.get('WHATSAPP_API_KEY') || ''
const WHATSAPP_INSTANCE = Deno.env.get('WHATSAPP_INSTANCE') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface PendingOrder {
  id: string
  numero: string
  updated_at: string
  dias_pronto: number
  cliente_nome: string
  cliente_telefone: string
  device_modelo: string
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY) {
    console.log(`[DRY RUN] WhatsApp para ${phone}: ${message}`)
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
      body: JSON.stringify({
        number: fullPhone,
        text: message,
      }),
    })
    return res.ok
  } catch (err) {
    console.error(`Erro ao enviar WhatsApp para ${phone}:`, err)
    return false
  }
}

Deno.serve(async (_req) => {
  try {
    // Buscar OS prontas há 3+ dias
    const { data: pendentes, error } = await supabase
      .from('v_os_prontas_pendentes')
      .select('*')

    if (error) throw error
    if (!pendentes || pendentes.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum lembrete pendente', count: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const results: { numero: string; dias: number; acao: string }[] = []

    for (const os of pendentes as PendingOrder[]) {
      // Verificar se já foi enviado lembrete hoje
      const { data: existing } = await supabase
        .from('reminders')
        .select('id')
        .eq('service_order_id', os.id)
        .eq('enviado', true)
        .gte('enviado_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (existing && existing.length > 0) {
        results.push({ numero: os.numero, dias: os.dias_pronto, acao: 'já notificado hoje' })
        continue
      }

      // OS pronta há 7+ dias → mensagem para o cliente
      if (os.dias_pronto >= 7) {
        const msg = [
          `Olá, ${os.cliente_nome}! 📱`,
          '',
          `Seu aparelho *${os.device_modelo}* (OS ${os.numero}) está *pronto para retirada* na AmoCelular há ${os.dias_pronto} dias.`,
          '',
          `Por favor, entre em contato para combinar a retirada.`,
          '',
          `📍 AmoCelular — Araraquara/SP`,
          `📞 Responda esta mensagem para mais informações.`,
        ].join('\n')

        const sent = await sendWhatsApp(os.cliente_telefone, msg)

        await supabase.from('reminders').insert({
          service_order_id: os.id,
          tipo: 'pronto_sem_retirada',
          enviado: sent,
          enviado_at: sent ? new Date().toISOString() : null,
          dias_limite: 7,
        })

        results.push({ numero: os.numero, dias: os.dias_pronto, acao: sent ? 'WhatsApp enviado' : 'falha no envio' })
      }
      // OS pronta há 3-6 dias → apenas registra alerta interno
      else {
        await supabase.from('reminders').insert({
          service_order_id: os.id,
          tipo: 'pronto_alerta_interno',
          enviado: true,
          enviado_at: new Date().toISOString(),
          dias_limite: 3,
        })

        results.push({ numero: os.numero, dias: os.dias_pronto, acao: 'alerta interno criado' })
      }
    }

    // Notificar admins sobre pendências
    const { data: admins } = await supabase
      .from('users')
      .select('telefone, nome')
      .eq('role', 'admin')
      .eq('ativo', true)

    if (admins && admins.length > 0) {
      const alertas7dias = (pendentes as PendingOrder[]).filter((o) => o.dias_pronto >= 7)
      if (alertas7dias.length > 0) {
        const resumo = [
          `⚠️ *AMO OS — Alerta de Retirada*`,
          '',
          `${alertas7dias.length} aparelho(s) pronto(s) há 7+ dias:`,
          '',
          ...alertas7dias.map((o) =>
            `• ${o.numero} — ${o.cliente_nome} (${o.device_modelo}) — ${o.dias_pronto} dias`
          ),
          '',
          `Ação: clientes foram notificados via WhatsApp.`,
        ].join('\n')

        for (const admin of admins) {
          if (admin.telefone) {
            await sendWhatsApp(admin.telefone, resumo)
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Lembretes processados', results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro no check-reminders:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
