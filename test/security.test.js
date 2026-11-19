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

 test('configura Firebase App Check com reCAPTCHA v3 e renovação automática', () => {
  assert.match(index, /firebase-app-check-compat\.js/);
  assert.match(index, /firebase\.appCheck\(/);
  assert.match(index, /ReCaptchaV3Provider/);
  assert.match(index, /isTokenAutoRefreshEnabled:\s*true/);
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
  assert.match(index, /function queryClientesOrganizacional\(\)[\s\S]*where\('organizationId','==',_organizationId\(\)\)/);
  assert.match(index, /orderBy\('updatedAt','desc'\)\.orderBy\(firebase\.firestore\.FieldPath\.documentId\(\)\)/);
  const config = JSON.parse(indexes);
  assert.ok(config.indexes.some((item) => item.collectionGroup === 'clients'
    && item.fields.some((field) => field.fieldPath === 'organizationId')
    && item.fields.some((field) => field.fieldPath === 'updatedAt')));
});

test('índice de inatividade cobre status e updatedAt dos clientes', () => {
  const config = JSON.parse(indexes);
  assert.ok(config.indexes.some((item) => item.collectionGroup === 'clients'
    && item.fields.some((field) => field.fieldPath === 'status')
    && item.fields.some((field) => field.fieldPath === 'updatedAt')));
});

test('CI executa testes, lint e valida Functions', () => {
  assert.match(workflow, /npm test/);
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
