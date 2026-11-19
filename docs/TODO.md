# Entregas da evolução do CRM

## Fase 5 — Testes reais do Firebase Emulator — concluída
- A suíte `test/emulator-security.test.js` executa Firestore e Storage Emulator de verdade.
- São verificados App Check obrigatório, isolamento entre organizações, tenant imutável, auditoria append-only e rejeição de uploads com metadata ou tipo inválidos.
- O workflow do GitHub Actions executa `npm run test:emulator` junto com os testes unitários.

## 1. Padronizar filtros da aba Análises
- Ao selecionar período relativo ou intervalo personalizado, todas as métricas, gráficos, tabelas, pivot, comissões, fluxo de caixa, metas e origem devem usar o mesmo conjunto filtrado.
- O intervalo personalizado deve exigir data inicial e final, aceitar as duas extremidades e bloquear ordem inválida.

## 2. Pipeline com previsão de fechamento
- Cada etapa deve exibir quantidade, valor, tempo parado e previsão ponderada.
- O usuário deve conseguir definir ou revisar probabilidade de fechamento e visualizar previsão por etapa e total.

## 3. Metas por vendedor
- O administrador/gestor deve conseguir configurar metas por vendedor e período.
- O sistema deve exibir realizado, percentual da meta, projeção e conversão.

## 4. Dashboard de origem e retorno comercial
- O sistema deve consolidar origem/campanha em leads, propostas, vendas, conversão, valor e ticket.
- Os dados devem respeitar os filtros de período, praça e vendedor.

## 5. Pós-venda e renovação
- O sistema deve mostrar clientes em implantação, pós-venda, renovação e risco.
- Deve permitir tarefas e próximos passos vinculados ao cliente.

## 6. Controle financeiro
- O sistema deve consolidar previsto, pago, pendente e atrasado, com filtros e visão futura.
- O fluxo deve permitir localizar rapidamente clientes e cobranças em atraso.

## 7. Relatórios PDF e Excel
- O usuário deve conseguir exportar relatórios filtrados para CSV compatível com Excel e PDF imprimível.
- As exportações devem conter período e filtros aplicados.

## 8. Modularização
- A lógica nova deve ficar em módulos JavaScript separados, com compatibilidade com as funções existentes durante a migração.

## 9. Escalabilidade
- O carregamento deve evitar consultas desnecessárias, usar carregamento sob demanda/paginação onde aplicável e manter feedback de carregamento/falha.

## 10. Backup e recuperação
- O usuário deve conseguir exportar backup completo e visualizar quando o último backup foi realizado.
- O sistema deve tratar falhas e preparar backup agendado no backend sem duplicação.

## 11. Notificações
- Notificações devem ser opt-in, categorizadas, acionáveis e sem duplicação após recarregar a página.

## 12. Melhorias menores
- Preservar filtros, preferências e contexto; adicionar ações rápidas e validações sem alterar o funcionamento legado.

## Fase 10 — Busca global avançada — concluída
- A busca global deve oferecer ranking por relevância, busca remota no Firestore, deduplicação de resultados, paginação por cursor, atalhos, navegação por teclado e acessibilidade ARIA.
- As buscas remotas devem usar campos normalizados específicos para nome, telefone, e-mail e título, com escopo por vendedor/organização e limites corretos de prefixo/cursor.
- Cloud Functions atualizam chaves em novas escritas; backfill de registros legados é paginado e somente leitura por padrão.

## Fase 11 — Projeção comercial avançada — concluída
- A projeção deve exibir cenários conservador, provável e otimista.
- Deve exibir propostas abertas, propostas implantadas, vidas projetadas, probabilidade de fechamento, média mensal e comparação com metas.
- Premissas por cenário e probabilidades por etapa são configuráveis e locais por usuário/navegador.
- A previsão usa resultados reais encerrados com probabilidade capturada na mudança de status, sem aplicar correção estatística antes da amostra mínima.
- A calibração usa o histórico disponível do vendedor/praça selecionados, sem restringir pela data de criação da proposta; estados terminais continuam 100% para sucesso e 0% para perda.

## Fase 12 — App Check em produção — implementação preparada; configuração externa pendente
- Configurar reCAPTCHA v3.
- Validar domínio de produção.
- Ativar enforcement no Firestore, Storage e Functions.
- Monitorar tokens rejeitados e exibir mensagens amigáveis.
- A ativação de produção requer confirmar a chave pública reCAPTCHA v3 e o domínio efetivamente publicado no Firebase Hosting; confirmar chegada de tokens válidos antes do enforcement.
- As regras locais de Firestore e Storage já exigem App Check. O repositório não contém Functions callable/HTTP invocadas pelo navegador; enforcement de Functions depende de um endpoint suportado e não se aplica aos gatilhos agendados/Firestore/Auth existentes.
