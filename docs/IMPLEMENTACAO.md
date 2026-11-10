# Implementação das melhorias do CRM

## O que foi implementado

- Regras de Firestore e Storage por usuário, organização e função.
- Bloqueio de alteração do próprio `role`.
- Proteção de anexos por cliente e limite de tamanho/tipo.
- Índices Firestore para leads, clientes, tarefas, auditoria e importações.
- Normalização automática de telefone, e-mail, CPF/CNPJ/CAEPF e valores nas Cloud Functions.
- Metadados de organização, responsável, criador, atualizador e timestamps Firestore.
- Pipeline com métricas por etapa: quantidade, valor e tempo médio parado.
- Histórico de mudança de status do lead.
- Motivo obrigatório para Perdido/Desistiu.
- Deduplicação de leads por telefone/e-mail normalizados.
- Cadência não duplicada quando já existe uma cadência ativa.
- Tarefas com status, conclusão, responsável e data de conclusão.
- Auditoria para criação, alteração, exclusão e conclusão de registros.
- Alerta de inatividade com chave idempotente por cliente/dia, sem dados sensíveis no texto.
- Limpeza agendada de notificações antigas.
- Timer de notificações do navegador sem duplicação após recarregamentos.

## Endurecimento das regras do Firestore

As regras agora limitam o autocadastro a perfis `vendedor`, permitem ao usuário alterar apenas campos comuns do próprio perfil e reservam a atribuição de `role` e `organizationId` a um administrador que esteja alterando outra conta. Vendedores, gerentes e supervisores só acessam registros associados à própria conta; somente administradores têm leitura e escrita administrativa global. O mesmo isolamento vale para anexos de clientes, backups, notificações, auditoria e histórico de importação. Os eventos de auditoria não podem ser alterados nem excluídos pelo cliente, e os jobs de importação preservam o proprietário e aceitam somente campos de conclusão.

Não implante antes de conferir a coleção `usuarios`: regras novas não corrigem papéis privilegiados que possam ter sido atribuídos enquanto regras antigas estavam ativas. Verifique cada conta `admin`, `gerente` e `supervisor` por um canal confiável e mantenha pelo menos uma conta administradora legítima acessível.

**Modelo escolhido:** isolamento individual. Os filtros do frontend devem consultar os registros do UID atual para todos os papéis não administradores; regras do Firestore e Storage aplicam o mesmo limite no servidor. Uma conta administrativa legítima continua podendo acessar todas as contas e registros.

## Implantação

1. Faça backup dos arquivos originais e dos dados do Firebase.
2. Instale o Firebase CLI e autentique-se na conta autorizada.
3. Dentro desta pasta, confira o projeto Firebase no `firebase.json`.
4. Instale as funções:

```bash
cd functions
npm install
```

5. Publique primeiro as regras e índices:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

6. Publique as funções:

```bash
firebase deploy --only functions
```

7. Publique o site somente depois de testar em homologação:

```bash
firebase deploy --only hosting
```

## Atenção

- A propriedade individual é definida por `userId`; somente documentos legados sem `userId` usam `organizationId == UID` como fallback. Registros com `userId` de outra conta não ficam acessíveis só porque compartilham `organizationId` ou `vendedorId`.
- Antes do deploy, confirme que existe pelo menos uma conta `admin` legítima e revise os papéis atuais; regras novas não revogam privilégios gravados anteriormente.
- O front-end ainda mantém campos ISO antigos para compatibilidade. As funções passam a preencher também campos `createdAtTs` e `updatedAtTs` do tipo Timestamp.
- Execute a suíte do repositório antes do deploy: `cd tests/security && npm install && npm test`. Ela testa Firestore e Storage localmente com vendedor, gerente, supervisor e admin, inclusive acesso a anexos e backups; usa o projeto fictício `demo-crm-security`.
- A validação de acesso nas regras é obrigatória; não confie somente nos filtros do JavaScript.
- Antes de dados reais, defina retenção, base legal, atendimento a solicitações do titular e procedimento de exclusão.
