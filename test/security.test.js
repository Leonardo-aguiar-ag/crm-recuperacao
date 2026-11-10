import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
const indexes = await readFile(new URL('../firebase/firestore.indexes.json', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

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
});

test('regras exigem segundo fator para administradores', () => {
  assert.match(rules, /hasSecondFactor\(\)/);
  assert.match(rules, /function isAdmin\(\)[\s\S]*hasSecondFactor/);
  assert.match(rules, /function isManager\(\)[\s\S]*role\(\) == 'admin' && hasSecondFactor/);
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
