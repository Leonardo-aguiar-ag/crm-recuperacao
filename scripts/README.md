# Organização dos scripts do frontend

O `index.html` mantém a estrutura visual e carrega os arquivos abaixo na ordem indicada. Os arquivos `scripts/app/` são scripts clássicos, não módulos ES: várias funções são chamadas por atributos `onclick`, e o código legado compartilha variáveis globais. Por isso, preserve a ordem no HTML e não adicione `defer`, `async` ou `type="module"` sem antes migrar essas dependências.

1. `app/00-core.js`: inicialização do Firebase, estado compartilhado, helpers, tema e autenticação.
2. `app/10-dashboard.js`: dashboard e análises.
3. `app/20-clients.js`: listagem, filtros e operações principais de clientes.
4. `app/30-client-details.js`: dependentes, pagamentos, anexos, autosave e interações.
5. `app/40-leads.js`: leads, cadências e funções de população relacionadas.
6. `app/50-admin-backups.js`: administração, backup e privacidade.
7. `app/60-import.js`: importação CSV e inicialização de eventos da interface.
8. `modules/crm-enhancements.js` e `modules/crm-tags.js`: melhorias carregadas depois da base legada.

A separação foi feita em fronteiras de seções existentes, sem alterar o corpo das funções. Para validar sintaxe, use `node --check` em cada arquivo; valide também a ordem das tags de script em `index.html`.
