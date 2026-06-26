-- ═══════════════════════════════════════════════════════════════
-- AMO OS — Dados de exemplo (seed)
-- Executar APÓS criar um usuário via Auth e inserir na tabela users
-- ═══════════════════════════════════════════════════════════════

-- Clientes
insert into public.customers (id, nome, telefone, cpf) values
  ('11111111-1111-1111-1111-111111111111', 'João Silva',      '(16) 99812-4471', '412.889.220-10'),
  ('22222222-2222-2222-2222-222222222222', 'Maria Santos',    '(16) 99745-1188', null),
  ('33333333-3333-3333-3333-333333333333', 'Pedro Lima',      '(16) 99980-2231', null),
  ('44444444-4444-4444-4444-444444444444', 'Camila Ferreira', '(16) 99654-9090', null),
  ('55555555-5555-5555-5555-555555555555', 'Lucas Martins',   '(16) 99877-3322', null),
  ('66666666-6666-6666-6666-666666666666', 'Ana Beatriz',     '(16) 99123-7765', '330.112.998-44');

-- Aparelhos
insert into public.devices (id, customer_id, marca, modelo, cor, imei, acessorios) values
  ('aaaaaaaa-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Apple',    'iPhone 13',      'Azul',   '356938035643809', '{capinha,chip}'),
  ('aaaaaaaa-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Samsung',  'Galaxy S22',     'Preto',  '351855112309887', '{carregador}'),
  ('aaaaaaaa-0003-0003-0003-000000000003', '33333333-3333-3333-3333-333333333333', 'Motorola', 'Moto G60',       'Preto',  '862188042200315', '{capinha,película}'),
  ('aaaaaaaa-0004-0004-0004-000000000004', '44444444-4444-4444-4444-444444444444', 'Xiaomi',   'Redmi Note 12',  'Azul',   '351112667700991', '{chip}'),
  ('aaaaaaaa-0005-0005-0005-000000000005', '55555555-5555-5555-5555-555555555555', 'Apple',    'iPhone 11',      'Branco', '356741092118843', '{capinha,película,chip}'),
  ('aaaaaaaa-0006-0006-0006-000000000006', '66666666-6666-6666-6666-666666666666', 'Samsung',  'Galaxy A54',     'Verde',  '356938033221107', '{carregador,chip}');

-- Ordens de serviço (numero gerado pelo trigger)
insert into public.service_orders (customer_id, device_id, status, problema_relatado, valor_servico, garantia_dias, condicao_estetica) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0001-0001-0001-000000000001', 'aprovacao',  'Tela trincada, touch falhando no canto superior.',   480, 90, '{"tela_trincada": true}'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0002-0002-0002-000000000002', 'manutencao', 'Não carrega. Conector oxidado.',                      260, 90, '{"oxidacao_aparente": true}'),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0003-0003-0003-000000000003', 'pronto',     'Troca de bateria.',                                  190, 90, '{}'),
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0004-0004-0004-000000000004', 'peca',       'Display com manchas, aguardando peça.',               0,   0,  '{}'),
  ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-0005-0005-0005-000000000005', 'analise',    'Molhou, não liga.',                                   0,   0,  '{"oxidacao_aparente": true}'),
  ('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-0006-0006-0006-000000000006', 'entregue',   'Troca de película + limpeza.',                        80,  30, '{}');
