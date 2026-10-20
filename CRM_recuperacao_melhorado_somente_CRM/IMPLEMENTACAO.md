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

## Implantação

1. Faça backup dos arquivos originais e dos dados do Firebase.
2. Instale o Firebase CLI e autentique-se na conta autorizada.
3. Dentro desta pasta, confira o projeto Firebase no `firebase.json`.
4. Instale as funções:

```bash
cd functions/functions
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

- As regras foram escritas para preservar o modelo atual baseado em `userId` e usar o UID como fallback de `organizationId`. Se houver uma organização Hapvida centralizada, ajuste `organizationId` no perfil do usuário antes de liberar acesso coletivo.
- O front-end ainda mantém campos ISO antigos para compatibilidade. As funções passam a preencher também campos `createdAtTs` e `updatedAtTs` do tipo Timestamp.
- Regras devem ser testadas no Firebase Emulator Suite com pelo menos vendedor, gerente e administrador.
- A validação de acesso nas regras é obrigatória; não confie somente nos filtros do JavaScript.
- Antes de dados reais, defina retenção, base legal, atendimento a solicitações do titular e procedimento de exclusão.
