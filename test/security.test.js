import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

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
const functionsSource = await readFile(new URL('../functions/index.js', import.meta.url), 'utf8');
const backfillSource = await readFile(new URL('../functions/scripts/backfill-search-index.js', import.meta.url), 'utf8');

function loadGlobalSearch() {
  const window = {};
  const document = { getElementById: () => null };
  runInNewContext(globalSearch, { window, document, setTimeout: () => 0, clearTimeout() {} });
  return window.crmGlobalSearch;
}

function loadEnhancements(storage = {}, clients = []) {
  const window = {
    currentUser: { uid: 'test-user' },
    clients,
    pessoas: [],
    localStorage: {
      getItem: key => storage[key] || null,
      setItem: (key, value) => { storage[key] = value; },
      removeItem: key => { delete storage[key]; }
    }
  };
  const document = { readyState: 'loading', getElementById: () => null, addEventListener() {} };
  runInNewContext(enhancements, { window, document });
  return window.crmEnhancements;
}

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
  assert.match(globalSearch, /buildPrefixQuery/);
  assert.match(globalSearch, /cursor \? query\.startAfter\(cursor\) : query\.startAt\(term\)/);
  assert.match(globalSearch, /searchNome/);
  assert.match(globalSearch, /searchTelefone/);
  assert.match(globalSearch, /searchEmail/);
  assert.match(globalSearch, /searchTitulo/);
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
  assert.match(enhancements, /conservativePercent/);
  assert.match(enhancements, /optimisticUplift/);
  assert.match(enhancements, /data-projection-stage/);
  assert.match(enhancements, /configuredProbability !== null && configuredProbability !== undefined/);
  assert.match(enhancements, /projectedLives/);
  assert.match(enhancements, /monthlyValue/);
  assert.match(enhancements, /valueGoalProgress/);
  assert.match(enhancements, /proposalGoalProgress/);
  assert.match(enhancements, /Projeção comercial avançada/);
});

test('busca remota normaliza acentos, diferencia e-mail/telefone e pagina sem limites incompatíveis', () => {
  const search = loadGlobalSearch();
  assert.equal(search.classifyRemoteTerm('João de Sá'), 'nome');
  assert.equal(search.normalizeRemoteTerm('João de Sá', 'nome'), 'joao de sa');
  assert.equal(search.normalizeRemoteTerm('Ana  Maria', 'nome'), 'ana maria');
  assert.equal(search.classifyRemoteTerm('(11) 98765-4321'), 'telefone');
  assert.equal(search.normalizeRemoteTerm('(11) 98765-4321', 'telefone'), '11987654321');
  assert.equal(search.classifyRemoteTerm('LEO@EXAMPLE.COM'), 'email');
  assert.equal(search.normalizeRemoteTerm('LEO@EXAMPLE.COM', 'email'), 'leo@example.com');
  const calls = [];
  const query = {
    startAfter(cursor) { calls.push(['startAfter', cursor]); return this; },
    startAt(term) { calls.push(['startAt', term]); return this; },
    endAt(term) { calls.push(['endAt', term]); return this; },
    limit(size) { calls.push(['limit', size]); return this; }
  };
  const cursor = { id: 'last' };
  search.buildPrefixQuery(query, 'joao', cursor);
  assert.deepEqual(calls, [['startAfter', cursor], ['endAt', `joao\uf8ff`], ['limit', 8]]);
});

test('projeção usa configurações locais por usuário e recalibra apenas faixas com amostra suficiente', () => {
  const storage = { 'crm-projection-settings:test-user': JSON.stringify({ conservativePercent: 50, optimisticUplift: 10, stageProbabilities: { Novo: 30 } }) };
  const api = loadEnhancements(storage);
  assert.equal(api.forecastFor({ status: 'Novo', probabilidadeFechamento: null }), 30);
  assert.equal(api.forecastFor({ status: 'Vendido', probabilidadeFechamento: 15 }), 100);
  assert.equal(api.forecastFor({ status: 'Perdido', probabilidadeFechamento: 65 }), 0);
  const closed = Array.from({ length: 8 }, (_, index) => ({
    status: index < 5 ? 'Vendido' : 'Perdido', probabilidadeFechamento: 65, valorComDesconto: 100,
    historico: [{ acao: 'STATUS_DECISION', status: index < 5 ? 'Vendido' : 'Perdido', probabilidadeFechamento: 65 }]
  }));
  const open = { status: 'Em análise', probabilidadeFechamento: 65, valorComDesconto: 1000, qtdVidas: 10 };
  const data = [...closed, open];
  const calibration = api.buildProbabilityCalibration(data);
  assert.equal(calibration.samples, 8);
  assert.equal(calibration.buckets[3].count, 8);
  assert.equal(api.calibratedProbability(65, calibration), 62.5);
  assert.equal(api.calibratedForecastFor({ status: 'Vendido', probabilidadeFechamento: 65 }, calibration), 100);
  assert.equal(api.calibratedForecastFor({ status: 'Perdido', probabilidadeFechamento: 65 }, calibration), 0);
  const filters = { start: '2026-01-01', end: '2026-02-28' };
  assert.equal(api.projectionFor([open], 'provável', filters, calibration).probability, 62.5);
  assert.equal(api.projectionFor([open], 'conservador', filters, calibration).probability, 31.25);
  assert.equal(api.projectionFor([open], 'otimista', filters, calibration).probability, 66.25);
  const tooFew = api.buildProbabilityCalibration(closed.slice(0, 7));
  assert.equal(api.calibratedProbability(65, tooFew), 65);
  const oldClosures = closed.map(client => ({ ...client, data: '2020-02-01', praca: 'Sul', vendedorId: 'seller-1' }));
  const historyApi = loadEnhancements({}, oldClosures);
  assert.equal(historyApi.calibrationUniverse({ start: '2026-01-01', end: '2026-02-28', praca: 'Sul', vendedor: 'seller-1' }).length, 8);
});

test('funções e script administrativo preenchem chaves normalizadas sem executar backfill automaticamente', () => {
  assert.match(functionsSource, /searchNome/);
  assert.match(functionsSource, /searchTelefone/);
  assert.match(functionsSource, /searchEmail/);
  assert.match(functionsSource, /normalizarTarefa/);
  assert.match(functionsSource, /before\.status!==after\.status/);
  assert.match(functionsSource, /alreadyRecorded/);
  assert.match(backfillSource, /--apply/);
  assert.match(backfillSource, /--all/);
  assert.match(backfillSource, /mode: options\.apply \? 'apply' : 'dry-run'/);
  assert.match(backfillSource, /if \(options\.apply && pageChanges\) await batch\.commit\(\)/);
  assert.doesNotMatch(backfillSource, /if\s*\(!options\.all\)\s*break/);
  assert.match(index, /function crmStatusDecisionEvent/);
  assert.match(index, /evento=crmStatusDecisionEvent\(existing,upd\.status/);
  assert.match(index, /STATUS_DECISION/);
});

test('busca remota declara índices para vendedores e organizações nas três coleções', () => {
  const config = JSON.parse(indexes);
  for (const [collection, owner, field] of [
    ...['userId', 'organizationId'].flatMap(owner => ['searchNome', 'searchTelefone', 'searchEmail'].map(field => ['clients', owner, field])),
    ...['userId', 'organizationId'].flatMap(owner => ['searchNome', 'searchTelefone', 'searchEmail'].map(field => ['leads', owner, field])),
    ['tarefas', 'userId', 'searchTitulo'], ['tarefas', 'organizationId', 'searchTitulo']
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
