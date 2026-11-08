# Roteiro do produto — Qualimix CRM

O CRM é construído em marcos independentes. Cada marco deixa o sistema utilizável e prepara o seguinte. O motor de cálculo de orçamentos (`src/lib/quote.ts`) já está pronto e testado, e será reutilizado no servidor.

## Marco 1 — Produto navegável e motor de orçamentos ✅

- Identidade visual (branco/preto/vermelho, títulos condensados, tema claro e escuro), menu lateral por módulos e layout responsivo.
- Painel gerencial com indicadores calculados a partir dos registros, gráficos e listas de acompanhamento.
- Gerador de orçamentos: calculadoras de volume (m³) e área (m²) com vários elementos e margem, itens do catálogo, frete, bombeamento, estadia, volume mínimo, descontos, condições e validade. Bloqueia proposta definitiva com preço pendente e sinaliza o que exige aprovação.
- Proposta em A4 com impressão/“Salvar como PDF” e compartilhamento pelo WhatsApp com mensagem editável.
- Lista de orçamentos com pesquisa, filtros, ordenação, paginação e duplicação com preços atuais.
- Clientes e obras: pesquisa por nome/CPF/CNPJ/telefone, cadastro rápido com validação de documento e alerta de duplicidade, visão consolidada do cliente.
- Funil comercial em colunas e em tabela, motivos de perda, fechamento explícito, follow-ups atrasados e histórico.
- Configurações (somente leitura) mostrando tudo que ainda depende da Qualimix.
- Dados de demonstração isolados em `src/data/fixtures.ts`, com botão para ocultá-los.
- Testes de cálculos, regras comerciais, formatação, documentos e indicadores.

## Marco 2 — Supabase e persistência multiusuário (pendente)

- Conectar ao projeto Supabase já indicado para o CRM; não criar um banco paralelo nem substituir o projeto por Drizzle.
- Confirmar o schema real no Supabase/Lovable antes de escrever consultas ou políticas. Mudanças estruturais devem seguir o fluxo Lovable definido pelo repositório; não criar migrations manualmente nesta etapa.
- Implementar cliente e camada de dados com variáveis de ambiente/segredos, sem credenciais no Git.
- Persistir clientes, obras, oportunidades, histórico, orçamentos, pedidos, agenda, profissionais, despesas, contas e baixas financeiras.
- Aplicar políticas RLS e validar que cada usuário só acessa os registros autorizados.
- Adicionar transações/constraints para garantir conversões idempotentes, vínculo referencial e baixa financeira sem duplicidade.
- Substituir o `localStorage` como fonte de verdade; manter somente rascunho offline opcional, com indicador explícito de sincronização.
- Recalcular orçamentos no servidor com `computeQuote` antes de salvar.

## Marco 3 — Autenticação, permissões e auditoria

- Autenticação independente de provedor (OIDC ou solução compatível com sessões seguras), com perfis Administrador, Comercial, Operação, Financeiro e Consulta.
- Permissões verificadas no servidor em toda leitura e escrita, não apenas na interface.
- Criação do primeiro administrador por convite (sem senha padrão).
- Registro de auditoria para preços, descontos, exceções, cancelamentos e baixas financeiras.
- Minimização de dados pessoais (LGPD): perfis Consulta não veem documentos e telefones completos.

## Marco 4 — Configurações editáveis

- Edição de catálogo (preço, vigência, status) com histórico de preços.
- Regras de frete, bombeamento, volume mínimo, estadia, pisos e limite de desconto.
- Formas de pagamento aceitas, validade padrão, numeração, regiões, origens de lead e etapas do funil.
- Dados institucionais e upload do logo oficial (armazenamento de objetos compatível com S3).
- Indicação clara do que é obrigatório para liberar cada funcionalidade.

## Marco 5 — Ciclo completo do orçamento

- Numeração sequencial única no banco, versões com snapshot e histórico de alterações.
- Fluxo de status: rascunho → aprovação interna → emissão → envio registrado → negociação → aceite/recusa → expiração automática.
- Aprovação de descontos e preços manuais por usuário autorizado, com registro de quem aprovou.
- PDF gerado no servidor e guardado por versão (armazenamento de objetos compatível com S3), com link de compartilhamento assinado e com prazo.
- Confirmação explícita de envio pelo WhatsApp.

## Marco 6 — Pedidos e agenda operacional

- **Interface local implementada parcialmente:** conversão de orçamento aceito em pedido e agenda ligada a pedido/cliente/obra/orçamento, com reagendamento, status e identificação livre de recurso operacional.
- **Persistência final pendente:** migrar o fluxo para Supabase com transação e chave única por versão aceita.
- Não haverá módulo separado de cadastro ou gestão de caminhões/frota neste escopo.
- Registro de conclusão e ocorrências pela equipe.

## Marco 7 — Financeiro

- **Interface local implementada parcialmente:** contas a receber geradas a partir do pedido; despesas por obra gerando contas a pagar; pagamentos parciais, baixa, cancelamento e histórico; saldo da obra = contratado − despesas.
- **Persistência/auditoria final pendente:** implementar as operações no Supabase com transações, controle de concorrência e trilha de auditoria.
- Relatórios de a receber, recebido no período, vencido e previsto; contratado × cobrado × recebido.
- Integração bancária futura (boleto/Pix), sem marcar pago sem confirmação.

## Marco 8 — Tarefas, notificações e qualidade final

- **Interface local implementada:** tarefas gerais ou ligadas a oportunidades, prazo, horário opcional, prioridade, conclusão, cancelamento e reabertura; a tarefa pendente atualiza o próximo contato no funil.
- **Painel local implementado:** lista os próximos retornos e destaca tarefas atrasadas e previstas para hoje.
- **Notificações externas pendentes:** agendador/cron, e-mail e push ainda precisam de serviço e configuração; os avisos atuais aparecem dentro do CRM e dependem de abrir o sistema.
- **Persistência e segurança pendentes:** tarefas e indicadores ainda usam armazenamento local; depois da integração Supabase, validar RLS e as permissões por perfil.
- Testes unitários das regras de tarefa adicionados; testes de permissões e end-to-end dos cenários de aceite continuam pendentes.
- Executar ESLint, testes, TypeScript e build antes de liberar produção.
