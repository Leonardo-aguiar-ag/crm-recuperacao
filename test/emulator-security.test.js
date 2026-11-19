import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-crm-recuperacao';
let testEnv;
let rules;
let storageRules;

function emulatorAddress(value, fallbackPort) {
  const [host, port] = String(value || `127.0.0.1:${fallbackPort}`).split(':');
  return { host: host || '127.0.0.1', port: Number(port || fallbackPort) };
}

before(async () => {
  [rules, storageRules] = await Promise.all([
    readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8'),
    readFile(new URL('../firebase/storage.rules', import.meta.url), 'utf8')
  ]);
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules, ...emulatorAddress(process.env.FIRESTORE_EMULATOR_HOST, 8080) },
    storage: { rules: storageRules, ...emulatorAddress(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 9199) }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'usuarios/user-a'), { organizationId: 'org-a', role: 'vendedor' });
    await setDoc(doc(db, 'usuarios/user-b'), { organizationId: 'org-b', role: 'vendedor' });
    await setDoc(doc(db, 'usuarios/manager-a'), { organizationId: 'org-a', role: 'gerente' });
    await setDoc(doc(db, 'usuarios/admin-a'), { organizationId: 'org-a', role: 'admin' });
    await setDoc(doc(db, 'clients/client-a'), {
      organizationId: 'org-a', userId: 'user-a', nomeTitular: 'Cliente A', updatedAt: '2026-11-19T00:00:00.000Z'
    });
    await setDoc(doc(db, 'clients/client-b'), {
      organizationId: 'org-b', userId: 'user-b', nomeTitular: 'Cliente B', updatedAt: '2026-11-19T00:00:00.000Z'
    });
    await setDoc(doc(db, 'audit_events/audit-1'), {
      userId: 'user-a', organizationId: 'org-a', acao: 'LOGIN', detalhes: {}, timestamp: '2026-11-19T00:00:00.000Z'
    });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

test('App Check é obrigatório para leitura e escrita autenticadas', async () => {
  const seller = testEnv.authenticatedContext('user-a');
  const db = seller.firestore();
  await assertFails(getDoc(doc(db, 'clients/client-a')));
  await assertFails(setDoc(doc(db, 'clients/new-client'), {
    organizationId: 'org-a', userId: 'user-a', nomeTitular: 'Novo'
  }));
});

test('sem App Check, nenhum usuário atravessa o limite de organização', async () => {
  const orgA = testEnv.authenticatedContext('user-a').firestore();
  const managerA = testEnv.authenticatedContext('manager-a').firestore();
  await assertFails(getDoc(doc(orgA, 'clients/client-b')));
  await assertFails(getDoc(doc(managerA, 'clients/client-b')));
});

test('tenant permanece imutável mesmo para administrador sem segundo fator', async () => {
  const admin = testEnv.authenticatedContext('admin-a').firestore();
  await assertFails(updateDoc(doc(admin, 'clients/client-a'), { organizationId: 'org-b' }));
});

test('auditoria não pode ser adulterada nem removida', async () => {
  const admin = testEnv.authenticatedContext('admin-a').firestore();
  await assertFails(updateDoc(doc(admin, 'audit_events/audit-1'), { acao: 'ALTERADO' }));
  await assertFails(setDoc(doc(admin, 'audit_events/audit-1'), { acao: 'REMOVIDO' }));
});

test('Storage exige App Check e bloqueia metadata inválida ou arquivo grande', async () => {
  const seller = testEnv.authenticatedContext('user-a');
  const storage = seller.storage();
  const valid = storage.ref('clientes/client-a/anexos/valid.pdf');
  await assertFails(valid.put(new Uint8Array([1, 2, 3]), {
    contentType: 'application/pdf', customMetadata: { organizationId: 'org-a', clientId: 'client-a' }
  }));
  const invalidMetadata = storage.ref('clientes/client-a/anexos/wrong.pdf');
  await assertFails(invalidMetadata.put(new Uint8Array([1]), {
    contentType: 'application/pdf', customMetadata: { organizationId: 'org-b', clientId: 'client-a' }
  }));
  const invalidType = storage.ref('clientes/client-a/anexos/script.exe');
  await assertFails(invalidType.put(new Uint8Array([1]), {
    contentType: 'application/x-msdownload', customMetadata: { organizationId: 'org-a', clientId: 'client-a' }
  }));
});
