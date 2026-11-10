# CRM Recuperação

## Organização das pastas

| Pasta / arquivo | O que é |
|---|---|
| `index.html`, `sw.js`, `manifest.json`, `logo.png`, `.nojekyll` | Site do CRM (precisam ficar na raiz para o GitHub Pages) |
| `scripts/app/` | Código legado do frontend dividido por área e carregado em ordem clássica |
| `scripts/analytics.js` | Bootstrap do Vercel Web Analytics |
| `styles/` | Estilos do frontend separados do HTML |
| `modules/` | Módulos JavaScript independentes de melhorias do CRM |
| `functions/` | Cloud Functions do Firebase |
| `firebase/` | Regras do Firestore e do Storage e índices |
| `firebase.json` | Configuração do Firebase (fica na raiz) |
| `docs/` | Documentação, plano, tarefas e arquivos históricos |
| `api/` | Endpoints serverless da Vercel para anexos |
| `lib/` | Código compartilhado pelas funções da Vercel |

## Publicar no Firebase

```bash
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting
```

## Upload de anexos no Vercel Blob

Os anexos de clientes são enviados pelas funções `api/blob-upload.js` e `api/blob-download.js` para um Blob Store privado da Vercel. O login do Firebase é validado no servidor antes do upload e antes da leitura, e o Firestore guarda apenas os metadados (`nome`, `pathname`, tipo e tamanho).

No projeto Vercel, conecte o Blob Store `crm-recuperacao-blob` ao projeto e confirme a variável `BLOB_READ_WRITE_TOKEN` nos ambientes **Production** e **Preview**. Não coloque o valor dessa variável no GitHub ou no `index.html`.

O upload atual aceita PDF, imagens, Word e Excel até **4,5 MB por arquivo**, limite do upload pelo servidor da Vercel. Anexos antigos que ainda tenham apenas `url` continuam sendo abertos normalmente pelo CRM.

## Vercel Web Analytics

O `index.html` inclui o script oficial do Vercel Web Analytics para registrar visitantes e visualizações de página. No painel da Vercel, abra **Analytics** do projeto e clique em **Enable**; depois de um novo deploy, os dados podem levar alguns segundos para aparecer.
