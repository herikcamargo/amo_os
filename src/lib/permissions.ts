// ═══════════════════════════════════════════════════════════════
// Sistema de Permissões — AMO OS
//
// Perfis:
//   admin     — acesso total: financeiro, relatórios, usuários, banco
//   atendente — criar/editar OS, atender clientes, SEM financeiro
//   tecnico   — atualizar status/diagnóstico, SEM financeiro
// ═══════════════════════════════════════════════════════════════

import type { UserRole, AppUser } from '@/types/database'

export type Permission =
  | 'view_financial'        // ver valores, faturamento, ticket médio
  | 'view_reports'          // acessar relatórios
  | 'view_audit_logs'       // logs de auditoria
  | 'manage_users'          // criar/editar/desativar usuários
  | 'manage_database'       // conexão Supabase, schema
  | 'manage_integrations'   // WhatsApp, Google Drive, etc.
  | 'manage_settings'       // alterar ajustes do sistema
  | 'create_order'          // criar nova OS
  | 'edit_order'            // editar dados da OS (cliente, aparelho)
  | 'update_status'         // mudar status / diagnóstico
  | 'delete_order'          // excluir OS
  | 'set_price'             // definir valor do serviço
  | 'export_pdf'            // baixar PDF de OS

const PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_financial', 'view_reports', 'view_audit_logs',
    'manage_users', 'manage_database', 'manage_integrations', 'manage_settings',
    'create_order', 'edit_order', 'update_status', 'delete_order',
    'set_price', 'export_pdf',
  ],
  atendente: [
    'create_order', 'edit_order', 'update_status', 'export_pdf',
  ],
  tecnico: [
    'update_status', 'export_pdf',
  ],
}

export function can(user: AppUser | null, action: Permission): boolean {
  if (!user || !user.ativo) return false
  return PERMISSIONS[user.role]?.includes(action) ?? false
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin': return 'Administrador'
    case 'atendente': return 'Atendente'
    case 'tecnico': return 'Técnico'
  }
}

export function roleColor(role: UserRole): string {
  switch (role) {
    case 'admin': return '#D71920'
    case 'atendente': return '#3B82F6'
    case 'tecnico': return '#F59E0B'
  }
}

export function roleDescription(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Acesso completo: financeiro, relatórios, usuários e configurações'
    case 'atendente':
      return 'Cria e edita OS, atende clientes. Sem acesso financeiro.'
    case 'tecnico':
      return 'Atualiza status e diagnóstico. Sem acesso financeiro.'
  }
}
