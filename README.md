# CRM Recuperação

## Organização das pastas

| Pasta / arquivo | O que é |
|---|---|
| `index.html`, `sw.js`, `manifest.json`, `logo.png`, `.nojekyll` | Site do CRM (precisam ficar na raiz para o GitHub Pages) |
| `modules/` | Módulos JavaScript com as melhorias do CRM |
| `functions/` | Cloud Functions do Firebase |
| `firebase/` | Regras do Firestore e do Storage e índices |
| `firebase.json` | Configuração do Firebase (fica na raiz) |
| `docs/` | Documentação, plano e lista de tarefas |
| `backups/` | Cópias antigas dos arquivos, antes das melhorias |

## Publicar no Firebase

```bash
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting
```
