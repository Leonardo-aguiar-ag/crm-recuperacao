# Módulos do CRM

A aplicação ainda mantém o código legado em `index.html` para preservar compatibilidade com os handlers existentes. Novas funcionalidades entram aqui e recebem uma ponte explícita por `window` para dados e serviços do Firebase.

## crm-enhancements.js

Centraliza filtros compartilhados da aba Análises, previsão ponderada do pipeline, metas por vendedor, origem e retorno comercial, resumo de pós-venda/financeiro e exportações Excel/PDF. O módulo envolve funções legadas somente depois de elas serem definidas, permitindo migração incremental sem uma reescrita de uma vez.

Os próximos módulos devem seguir a mesma regra: nenhuma escrita de banco deve ignorar as regras do Firestore, e cada módulo deve oferecer uma função de renderização idempotente para poder ser chamado após filtros, carregamentos e atualizações.
