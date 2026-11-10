# Documentação do CRM

- [`IMPLEMENTACAO.md`](IMPLEMENTACAO.md): melhorias já implementadas e passos de implantação do Firebase.
- [`plan.md`](plan.md): plano de evolução do produto e critérios técnicos.
- [`TODO.md`](TODO.md): entregas planejadas para as próximas etapas.
- [`archive/`](archive/): cópias históricas mantidas apenas para referência; não são usadas no deploy.

## Estrutura do código

- `index.html`: aplicação web principal e compatibilidade com o código legado.
- `modules/`: módulos JavaScript do frontend.
- `api/`: endpoints serverless da Vercel para upload e download de anexos.
- `lib/`: autenticação compartilhada pelas funções da Vercel.
- `functions/`: Cloud Functions do Firebase.
- `firebase/`: regras e índices do Firestore e Storage.
