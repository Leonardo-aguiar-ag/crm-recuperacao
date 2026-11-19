# Módulos do CRM

A aplicação ainda mantém o código legado em `index.html` para preservar compatibilidade com os handlers existentes. Novas funcionalidades entram aqui e recebem uma ponte explícita por `window` para dados e serviços do Firebase.

## crm-enhancements.js

Centraliza filtros compartilhados da aba Análises, previsão ponderada do pipeline, metas por vendedor, origem e retorno comercial, resumo de pós-venda/financeiro e exportações Excel/PDF. O módulo envolve funções legadas somente depois de elas serem definidas, permitindo migração incremental sem uma reescrita de uma vez.

Os próximos módulos devem seguir a mesma regra: nenhuma escrita de banco deve ignorar as regras do Firestore, e cada módulo deve oferecer uma função de renderização idempotente para poder ser chamado após filtros, carregamentos e atualizações.

## crm-global-search.js

Implementa a busca global por clientes/propostas, leads, tarefas e pagamentos. Combina ranking local com buscas remotas por prefixo no Firestore, aplica o escopo do vendedor ou da organização, deduplica por tipo e ID e pagina novos resultados usando cursores. A caixa de busca usa combobox/listbox ARIA, estado anunciado por leitor de tela e navegação por setas, Enter, Escape e Page Up/Down; `/` continua sendo o atalho global.

## Projeção comercial avançada

`crm-enhancements.js` calcula simultaneamente cenários conservador, provável e otimista. A premissa de cada cenário é mostrada junto dos resultados; o cálculo separa propostas abertas, registros implantados, vidas projetadas, probabilidade ponderada por valor e média mensal comparada às metas mensais existentes.
