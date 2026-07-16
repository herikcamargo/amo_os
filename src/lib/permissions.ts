// ═══════════════════════════════════════════════════════════════
// Sistema de Permissões — AMO OS
//
// Perfis:
//   admin       — acesso total: financeiro, usuários, configurações
//   funcionario — acesso a tudo, EXCETO financeiro e alterações
//                 críticas (usuários, configurações, exclusões)
//
// Perfis antigos (atendente/tecnico) sao tratados como funcionario
// caso ainda apareçam em sessões/dados persistidos.
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

export type EffectiveRole = 'admin' | 'funcionario'

export function normalizeRole(role: UserRole): EffectiveRole {
  return role === 'admin' ? 'admin' : 'funcionario'
}

const PERMISSIONS: Record<EffectiveRole, Permission[]> = {
  admin: [
    'view_financial', 'view_reports', 'view_audit_logs',
    'manage_users', 'manage_database', 'manage_integrations', 'manage_settings',
    'create_order', 'edit_order', 'update_status', 'delete_order',
    'set_price', 'export_pdf',
  ],
  funcionario: [
    'view_reports',
    'create_order', 'edit_order', 'update_status',
    'set_price', 'export_pdf',
  ],
}

export function can(user: AppUser | null, action: Permission): boolean {
  if (!user || !user.ativo) return false
  return PERMISSIONS[normalizeRole(user.role)].includes(action)
}

export function roleLabel(role: UserRole): string {
  return normalizeRole(role) === 'admin' ? 'Administrador' : 'Funcionário'
}

export function roleColor(role: UserRole): string {
  return normalizeRole(role) === 'admin' ? '#D71920' : '#3B82F6'
}

export function roleDescription(role: UserRole): string {
  return normalizeRole(role) === 'admin'
    ? 'Acesso completo: financeiro, relatórios, usuários e configurações'
    : 'Acesso a tudo do dia a dia (OS, clientes, vendas, preços, relatórios). Sem financeiro nem alterações críticas.'
}
