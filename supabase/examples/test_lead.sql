-- QUALIMIX CRM — criar cliente + lead fictício de integração.
-- Execute no SQL Editor APÓS o SQL base, a migration custom auth e o bootstrap admin.
-- Não altera registros existentes. O lead é is_demo=false para aparecer na produção.
DO $$
DECLARE
  v_owner_id uuid;
  v_client_id text;
  v_lead_id text;
  v_tag text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_client_name text;
  v_lead_title text;
BEGIN
  SELECT id
    INTO v_owner_id
    FROM public.perfis
   WHERE ativo = true
     AND perfil IN ('administrador', 'comercial')
   ORDER BY CASE WHEN perfil = 'administrador' THEN 0 ELSE 1 END, created_at
   LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum perfil comercial ativo encontrado. Execute o bootstrap do administrador primeiro.';
  END IF;

  v_client_name := '[TESTE CRM] Cliente de integração ' || v_tag;
  v_lead_title := '[TESTE CRM] Lead de integração ' || v_tag;

  INSERT INTO public.clientes (
    nome, tipo, origem, responsavel_id, created_by, observacoes, is_demo
  ) VALUES (
    v_client_name, 'Empresa', 'Outros', v_owner_id, v_owner_id,
    'Registro fictício para validar a integração do Qualimix CRM.', false
  )
  RETURNING id INTO v_client_id;

  INSERT INTO public.oportunidades (
    titulo, cliente_id, etapa, valor_estimado, responsavel_id, origem, entrou_em,
    historico, relatorios, is_demo, created_by
  ) VALUES (
    v_lead_title, v_client_id, 'novo', 15000.00, v_owner_id, 'Outros', current_date,
    jsonb_build_array(jsonb_build_object(
      'at', now(),
      'by', v_owner_id,
      'text', 'Lead criado para teste da integração do banco de dados.'
    )),
    '[]'::jsonb, false, v_owner_id
  )
  RETURNING id INTO v_lead_id;

  RAISE NOTICE 'Cliente criado: % | Lead criado: %', v_client_id, v_lead_id;
END $$;

-- Resultado para conferência no próprio SQL Editor.
SELECT
  o.id AS oportunidade_id,
  o.titulo,
  o.etapa,
  o.valor_estimado,
  o.origem,
  o.entrou_em,
  c.id AS cliente_id,
  c.nome AS cliente,
  p.nome AS responsavel,
  o.created_at
FROM public.oportunidades o
JOIN public.clientes c ON c.id = o.cliente_id
LEFT JOIN public.perfis p ON p.id = o.responsavel_id
WHERE o.titulo LIKE '[TESTE CRM] Lead de integração %'
ORDER BY o.created_at DESC
LIMIT 10;
