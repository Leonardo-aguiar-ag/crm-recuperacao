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
- MFA TOTP nativo do Firebase para administradores, com desafio no login e matrícula por aplicativo autenticador.
- Regras do Firestore exigindo o claim de segundo fator para operações administrativas.
- Inicialização do Firebase App Check com reCAPTCHA v3 e renovação automática de token.
- Busca global classificada por relevância, com consultas remotas limitadas e por tenant, deduplicação, cursor de continuação, atalhos de teclado e combobox/listbox ARIA.
- Busca remota em campos normalizados de nome, telefone e e-mail para clientes/leads, e título para tarefas; consultas escolhem o campo pelo tipo do termo.
- Projeção comercial em três cenários editáveis por usuário/navegador, com probabilidades por etapa, propostas abertas, implantação, vidas, média mensal e metas.
- Calibração de pipeline usa snapshots de probabilidade no fechamento, conversão real por faixa e suavização; exige 8 casos por faixa antes de alterar a previsão.
- Workflow GitHub Actions em `.github/workflows/ci.yml` executando testes, validação de sintaxe e validação das Functions.
- Suíte de segurança executada no Firestore e Storage Emulator, cobrindo App Check obrigatório, isolamento entre organizações, tenant imutável, auditoria append-only e bloqueio de uploads inválidos.

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

### Testes reais do Firebase Emulator

Execute localmente com Java instalado:

```bash
npm run test:emulator
```

O comando inicia Firestore e Storage Emulator, executa `test/emulator-security.test.js` e encerra os serviços ao final. A biblioteca oficial de testes não injeta um App Check positivo no Emulator; por isso a suíte valida diretamente que toda requisição sem App Check é rejeitada e executa os demais cenários de negação contra os emuladores reais. A aceitação de tokens App Check deve ser verificada após o deploy, no ambiente Firebase com reCAPTCHA v3 configurado.

## MFA de administradores

No Firebase Console, habilite **Authentication > Sign-in method > Multi-factor authentication > TOTP**. Cada usuário com `role: admin` deve abrir o perfil, escanear o QR Code com um aplicativo autenticador e confirmar um código de seis dígitos. Depois da matrícula, saia e entre novamente: o login passa a exigir o código TOTP.

As regras do Firestore verificam `request.auth.token.firebase.sign_in_second_factor`; portanto, mudar apenas o campo `role` não contorna o MFA. A primeira matrícula precisa ocorrer em uma sessão autenticada e, em seguida, o administrador deve fazer novo login para receber o claim de segundo fator.

## Firebase App Check

O frontend inicia Firebase App Check com reCAPTCHA v3, renova tokens automaticamente, registra o host atual para diagnóstico e exibe um aviso se faltar chave ou a página publicada não usar HTTPS. As regras do Firestore e Storage recusam operações sem App Check. A chave pública ainda deve ser preenchida no meta tag `firebase-app-check-site-key` em `index.html`; ela não é segredo. O repositório não define o domínio de produção, portanto confirme o host real em Firebase Hosting antes de registrá-lo na chave reCAPTCHA e em Authentication > Authorized domains.

1. No Firebase Console, registre o app Web em **App Check** usando reCAPTCHA v3 e permita o domínio exato de produção na configuração do reCAPTCHA.
2. Preencha o meta tag `firebase-app-check-site-key` em `index.html` com a site key pública correspondente ao app Web e ao domínio confirmado. Não use secret key no frontend.
3. Publique em homologação e confirme tokens válidos no painel **App Check > Apps / APIs** antes de ativar enforcement. Revise as métricas e solicitações rejeitadas; não habilite enforcement com tráfego legítimo ainda sem token.
4. Depois de validar tráfego, ative enforcement para Firestore e Storage no Firebase Console. As regras versionadas também exigem `request.appCheck != null`; o console e as regras devem permanecer alinhados.
5. O código oferece mensagens amigáveis para falhas App Check identificáveis e contagem em memória sem registrar tokens ou dados pessoais. Para o total autoritativo de tokens válidos/rejeitados, use as métricas do Firebase Console; `permission-denied` pode representar outras recusas das regras e não deve ser tratado como confirmação de token inválido.
6. O projeto não exporta Functions HTTP ou callable consumidas pelo navegador; as Functions atuais são gatilhos Firestore/Auth ou agendados. Enforcement App Check de Functions aplica-se a endpoints suportados (por exemplo, callable com `functions.runWith({enforceAppCheck:true})`), não aos gatilhos de backend. Não há endpoint cliente para colocar em enforcement hoje; se um callable/HTTP for adicionado, exija App Check nele e valide a invocação com token válido.

Para testes locais, use o token de debug documentado pelo Firebase; nunca publique esse token em produção.

## Busca remota normalizada

As Cloud Functions normalizam os campos de busca em qualquer escrita de cliente, lead ou tarefa. O frontend também grava esses campos em propostas e tarefas; os índices compostos usam o escopo de vendedor ou organização. Para registros legados, o script administrativo pode fazer a atualização gradualmente. Ele usa Application Default Credentials e é **somente leitura por padrão**:

```bash
cd functions && npm ci
node scripts/backfill-search-index.js --collection=clients --limit=250
```

Confira a contagem do dry-run, faça backup e, se estiver aprovado, repita com `--apply`. `--limit` é o total máximo de documentos percorridos naquela execução (não apenas o tamanho da página); use o `--after=<nextAfter>` retornado para a próxima execução. `--all` percorre o restante da coleção e deve ser usado apenas após revisar o impacto de leituras e gravações. Repita para `leads` e `tarefas`. Não execute o backfill contra produção sem autorização operacional e janela apropriada.

Publique `firestore:indexes` e as Cloud Functions antes de habilitar as novas consultas remotas. O deploy de regras/índices não é executado por este script.

## Projeção configurável e calibração

As premissas conservadora e otimista e as probabilidades padrão por etapa podem ser alteradas na seção **Ajustar premissas**. A configuração é guardada no `localStorage`, separada por UID do usuário neste navegador, e não altera automaticamente as probabilidades salvas nas propostas. Restaurar padrão remove apenas essa preferência local. A calibração usa todo o histórico disponível do vendedor/praça selecionados, sem depender da data de criação da proposta atualmente filtrada.

Quando uma proposta muda para `Implantado`, `Vendido`, `Perdido` ou `Desistiu`, a gravação registra a probabilidade e o resultado no histórico. A tabela compara probabilidades com resultados fechados em faixas de 20 pontos. Faixas com menos de oito casos não recalibram as previsões; acima desse mínimo aplica-se suavização com peso prévio de cinco casos, ancorada na conversão geral observada. Registros antigos entram na calibração apenas se tiverem uma probabilidade explícita confiável no fechamento ou no campo atual.

## Login com Facebook e Microsoft

O login agora oferece Google, Facebook e Microsoft pelo Firebase Authentication. Para ativá-los no projeto:

1. Abra **Authentication > Sign-in method** no Firebase Console.
2. Ative **Facebook** e informe o App ID e o App Secret criados no Meta for Developers. No Meta, cadastre o OAuth redirect URI exibido pelo Firebase, normalmente `https://crm-recuperacao.firebaseapp.com/__/auth/handler`.
3. Ative **Microsoft** e informe o Client ID e o Client Secret de um App Registration no Microsoft Entra ID. Cadastre também o redirect URI `https://crm-recuperacao.firebaseapp.com/__/auth/handler` como plataforma Web.
4. Confirme que `crm-recuperacao.firebaseapp.com` e o domínio de produção estão em **Authentication > Settings > Authorized domains**.

As credenciais de Facebook e Microsoft devem ser configuradas apenas no Firebase Console; não devem ser colocadas no código ou no GitHub. Se o mesmo e-mail já existir em outro provedor, o usuário deve entrar pelo provedor original e fazer a vinculação de credenciais conforme a política definida no Firebase.

## CI no GitHub

O workflow roda em cada push e pull request para `main`. Localmente, os mesmos comandos podem ser executados com:

```bash
npm ci
npm test
npm run lint
cd functions && npm ci && node --check index.js
```

## Atenção

- As regras foram escritas para preservar o modelo atual baseado em `userId` e usar o UID como fallback de `organizationId`. Se houver uma organização Hapvida centralizada, ajuste `organizationId` no perfil do usuário antes de liberar acesso coletivo.
- O front-end ainda mantém campos ISO antigos para compatibilidade. As funções passam a preencher também campos `createdAtTs` e `updatedAtTs` do tipo Timestamp.
- Regras devem ser testadas no Firebase Emulator Suite com pelo menos vendedor, gerente e administrador.
- A validação de acesso nas regras é obrigatória; não confie somente nos filtros do JavaScript.
- Antes de dados reais, defina retenção, base legal, atendimento a solicitações do titular e procedimento de exclusão.
