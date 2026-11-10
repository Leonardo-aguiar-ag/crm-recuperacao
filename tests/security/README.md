# Testes de segurança Firebase

Esta suíte valida as regras de Firestore e Storage somente nos emuladores locais, usando o projeto fictício `demo-crm-security`. Ela cobre autocadastro e papéis, acesso individual de vendedor/gerente/supervisor, acesso global de admin, auditoria, jobs de importação, anexos e backups.

Requisitos: Node.js 20+ e Java 21+.

```bash
cd tests/security
npm install
npm test
```

O Firebase CLI baixa os emuladores na primeira execução. Os testes não leem nem alteram dados de produção. Não troque o ID `demo-crm-security` por um projeto real.
