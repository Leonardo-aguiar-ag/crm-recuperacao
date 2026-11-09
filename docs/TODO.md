# Entregas da evolução do CRM

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
