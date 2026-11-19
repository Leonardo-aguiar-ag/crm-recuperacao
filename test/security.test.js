import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
const storageRules = await readFile(new URL('../firebase/storage.rules', import.meta.url), 'utf8');
const indexes = await readFile(new URL('../firebase/firestore.indexes.json', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const uploadApi = await readFile(new URL('../api/blob-upload.js', import.meta.url), 'utf8');
const downloadApi = await readFile(new URL('../api/blob-download.js', import.meta.url), 'utf8');
const botIdClient = await readFile(new URL('../botid-client.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const globalSearch = await readFile(new URL('../modules/crm-global-search.js', import.meta.url), 'utf8');
const enhancements = await readFile(new URL('../modules/crm-enhancements.js', import.meta.url), 'utf8');

test('configura Firebase App Check com reCAPTCHA v3 e renovação automática', () => {
  assert.match(index, /firebase-app-check-compat\.js/);
  assert.match(index, /firebase\.appCheck\(/);
  assert.match(index, /ReCaptchaV3Provider/);
  assert.match(index, /isTokenAutoRefreshEnabled:\s*true/);
  assert.match(index, /location\.protocol === 'https:'/);
  assert.match(index, /dataset\.appCheckHost/);
});

test('busca global pontua e deduplica resultados locais e remotos com paginação por cursor', () => {
  assert.match(globalSearch, /let score = exact \? 100/);
  assert.match(globalSearch, /const key = `\$\{spec\.type\}:\$\{doc\.id\}`/);
  assert.match(globalSearch, /query\.startAt\(term\)\.endAt\(`\$\{term\}\\uf8ff`\)\.limit\(PAGE_SIZE\)/);
  assert.match(globalSearch, /query\.startAfter\(cursor\)/);
  assert.match(globalSearch, /Carregar mais resultados/);
  assert.match(globalSearch, /Promise\.allSettled/);
  assert.match(globalSearch, /escapeHtml/);
});

test('busca global oferece teclado e semântica ARIA de combobox/listbox', () => {
  assert.match(globalSearch, /setAttribute\('role', 'combobox'\)/);
  assert.match(globalSearch, /setAttribute\('role', 'listbox'\)/);
  assert.match(globalSearch, /role="option"/);
  assert.match(globalSearch, /aria-activedescendant/);
  assert.match(globalSearch, /event\.key === 'ArrowDown'/);
  assert.match(globalSearch, /event\.key === 'ArrowUp'/);
  assert.match(globalSearch, /event\.key === 'Escape'/);
  assert.match(index, /Atalho: \/\)/);
});

test('projeção comercial exibe cenários, probabilidades, vidas, média mensal e metas', () => {
  assert.match(enhancements, /probability \* 0\.75/);
  assert.match(enhancements, /probability \+ \(100 - probability\) \* 0\.25/);
  assert.match(enhancements, /configuredProbability !== null && configuredProbability !== undefined/);
  assert.match(enhancements, /projectedLives/);
  assert.match(enhancements, /monthlyValue/);
  assert.match(enhancements, /valueGoalProgress/);
  assert.match(enhancements, /proposalGoalProgress/);
  assert.match(enhancements, /Projeção comercial avançada/);
});

test('busca remota declara índices para vendedores e organizações nas três coleções', () => {
  const config = JSON.parse(indexes);
  for (const [collection, owner, field] of [
    ['clients', 'userId', 'nomeTitular'], ['clients', 'organizationId', 'nomeTitular'],
    ['leads', 'userId', 'nome'], ['leads', 'organizationId', 'nome'],
    ['tarefas', 'userId', 'titulo'], ['tarefas', 'organizationId', 'titulo']
  ]) {
    assert.ok(config.indexes.some(item => item.collectionGroup === collection
      && item.fields.some(value => value.fieldPath === owner)
      && item.fields.some(value => value.fieldPath === field)));
  }
});

test('mensagens App Check são amigáveis e o diagnóstico não grava tokens', () => {
  assert.match(index, /function mensagemErroAppCheck\(\)/);
  assert.match(index, /function registrarFalhaAppCheck\(e,area\)/);
  assert.match(index, /rejeicoes\+\+/);
  assert.match(index, /chave reCAPTCHA v3 e se este domínio está autorizado/);
  assert.doesNotMatch(index, /console\.log\([^\n]*appCheckToken/);
});

test('administração usa TOTP MFA real do Firebase', () => {
  assert.match(index, /TotpMultiFactorGenerator/);
  assert.match(index, /multiFactor\.getSession/);
  assert.match(index, /multiFactor\.enroll/);
  assert.match(index, /getMultiFactorResolver/);
  assert.match(index, /function isAdminMfaEnabled[\s\S]*multiFactor.*enrolledFactors/);
  assert.match(index, /userRole === 'admin' && !isAdminMfaEnabled/);
});

test('login oferece Facebook e Microsoft via Firebase Auth', () => {
  assert.match(index, /FacebookAuthProvider/);
  assert.match(index, /facebookLogin/);
  assert.match(index, /OAuthProvider\('microsoft\.com'\)/);
  assert.match(index, /microsoftLogin/);
});

test('cadastro solicita nome, e-mail, senha e confirmação da senha', () => {
  assert.match(index, /id="cadastroNome"/);
  assert.match(index, /id="cadastroEmail"/);
  assert.match(index, /id="cadastroSenha"/);
  assert.match(index, /id="cadastroSenhaConfirmacao"/);
  assert.match(index, /p!==confirmacao/);
  assert.match(index, /function fecharCadastro/);
  assert.match(index, /modal\.style\.display='block'/);
  assert.match(styles, /#modalCadastro\{z-index:10000/);
  assert.match(index, /function alternarSenhaCadastro/);
  assert.match(index, /alternarSenhaCadastro\('cadastroSenhaConfirmacao'/);
});

test('regras exigem segundo fator para administradores', () => {
  assert.match(rules, /hasSecondFactor\(\)/);
  assert.match(rules, /function isAdmin\(\)[\s\S]*hasSecondFactor/);
  assert.match(rules, /function isManager\(\)[\s\S]*role\(\) == 'admin' && hasSecondFactor/);
});

test('regras exigem App Check e isolam dados por organização', () => {
  assert.match(rules, /function verifiedApp\(\)[\s\S]*request\.appCheck != null/);
  assert.match(rules, /function organizationId\(\)/);
  assert.match(rules, /data\.organizationId == organizationId\(\)/);
  assert.match(rules, /preservesTenant\(existing, incoming\)/);
  assert.doesNotMatch(rules, /allow read: if isManager\(\);/);
  assert.match(rules, /allow update, delete: if false;/);
});

test('Storage valida tenant, conteúdo e tamanho dos anexos', () => {
  assert.match(storageRules, /function verifiedApp\(\)/);
  assert.match(storageRules, /request\.resource\.metadata\.organizationId == organizationId\(\)/);
  assert.match(storageRules, /request\.resource\.metadata\.clientId == clientId/);
  assert.match(storageRules, /request\.resource\.size < 10 \* 1024 \* 1024/);
  assert.match(storageRules, /allow read, write: if false/);
});

test('renders dinâmicos críticos escapam texto e uploads propagam o tenant', () => {
  assert.match(index, /function _esc\(s\)/);
  assert.match(index, /_esc\(p\.nome\)/);
  assert.match(index, /_esc\(n\)/);
  assert.match(index, /customMetadata:\{userId:currentUser\.uid,organizationId:_organizationId\(\)\}/);
  assert.match(index, /app-check-required/);
});

test('sinks XSS prioritários usam texto seguro, URL allowlist e mensagens escapadas', () => {
  assert.match(index, /function showToast\([\s\S]*text\.textContent=String\(msg\?\?''\)/);
  assert.doesNotMatch(index, /t\.innerHTML=`<i class=/);
  assert.match(index, /function _safeHttpUrl\(value\)/);
  assert.match(index, /safeUrl\?`<a class="btn btn-sm btn-outline-primary"/);
  assert.match(index, /_esc\(r\._errors\.join\('; '\)\)/);
  assert.match(index, /_esc\(l\.nome\|\|'-'\)/);
  assert.match(index, /_esc\(c\.nomeTitular\|\|'-'\)/);
});

test('layout mobile reduz overflow de topbar, notificações, tarefas e pipeline', () => {
  assert.match(styles, /@media \(max-width: 576px\)/);
  assert.match(styles, /#notificacoesDropdown\{width:min\(380px/);
  assert.match(styles, /\.tarefa-card>div:last-child/);
  assert.match(styles, /\.pipeline-column\{min-width:calc\(100vw - 48px\)!important\}/);
});

test('paginação Firestore usa cursor, tenant e ordenação determinística', () => {
  assert.match(index, /async function loadPage\(query,pageSize=25,cursor=null\)/);
  assert.match(index, /q\.startAfter\(cursor\)/);
  assert.match(index, /function queryClientesOrganizacional\(\{ordered=true\}=\{\}\)[\s\S]*where\('organizationId','==',_organizationId\(\)\)/);
  assert.match(index, /orderBy\('updatedAt','desc'\)\.orderBy\(firebase\.firestore\.FieldPath\.documentId\(\)\)/);
  const config = JSON.parse(indexes);
  assert.ok(config.indexes.some((item) => item.collectionGroup === 'clients'
    && item.fields.some((field) => field.fieldPath === 'organizationId')
    && item.fields.some((field) => field.fieldPath === 'updatedAt')));
});

test('tabela de clientes conecta paginação visual, carregamento, retry e reset de filtros', () => {
  assert.match(index, /async function carregarPaginaClientesVisual/);
  assert.match(index, /clientesPaginacao\.cursorStack/);
  assert.match(index, /id="clientTableStatus"[^>]*aria-live="polite"/);
  assert.match(index, /function retryPaginaClientes\(\)/);
  assert.match(index, /function clientesTemFiltros\(\)/);
  assert.match(index, /Página \$\{paginaClientes\} carregada do Firestore/);
  assert.match(index, /clientesPaginacao\.currentDocs/);
  assert.match(index, /Índice pendente: exibindo clientes em modo temporário/);
});

test('índice de inatividade cobre status e updatedAt dos clientes', () => {
  const config = JSON.parse(indexes);
  assert.ok(config.indexes.some((item) => item.collectionGroup === 'clients'
    && item.fields.some((field) => field.fieldPath === 'status')
    && item.fields.some((field) => field.fieldPath === 'updatedAt')));
});

test('CI executa testes, lint e valida Functions', () => {
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run test:emulator/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /node --check index\.js/);
});

test('endpoints de anexos exigem classificação BotID e frontend protege as mesmas rotas', () => {
  assert.match(uploadApi, /requireHuman/);
  assert.match(downloadApi, /requireHuman/);
  assert.match(botIdClient, /\/api\/blob-upload/);
  assert.match(botIdClient, /\/api\/blob-download/);
  assert.match(botIdClient, /method: 'POST'/);
  assert.match(botIdClient, /method: 'GET'/);
});

test('CSS principal fica separado do HTML', () => {
  assert.match(index, /<link rel="stylesheet" href="styles\.css" \/>/);
  assert.doesNotMatch(index, /<style>\s*:root/);
  assert.match(styles, /:root\{/);
  assert.match(styles, /\.login-screen\{/);
});
