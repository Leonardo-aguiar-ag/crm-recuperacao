import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const projectId = 'demo-crm-security';
const rules = await readFile(resolve(root, 'firebase/firestore.rules'), 'utf8');
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });
const profile = (db, uid) => doc(db, 'usuarios', uid);

try {
  const seller = env.authenticatedContext('seller-a').firestore();
  const otherSeller = env.authenticatedContext('seller-b').firestore();
  const attacker = env.authenticatedContext('attacker').firestore();
  const manager = env.authenticatedContext('manager-a').firestore();
  const supervisor = env.authenticatedContext('supervisor-a').firestore();
  const admin = env.authenticatedContext('admin-a').firestore();

  await assertSucceeds(setDoc(profile(seller, 'seller-a'), {
    nome: 'Vendedor', email: 'seller@example.test', role: 'vendedor',
    servico: 'CRM', createdAt: '2026-01-01'
  }));
  await assertSucceeds(setDoc(profile(otherSeller, 'seller-b'), {
    nome: 'Perfil sem papel', telefone: '000000000', cidade: 'São Paulo'
  }));
  console.log('PASS: autocadastro e perfil básico próprio permitidos');

  await assertFails(setDoc(profile(attacker, 'attacker'), { role: 'admin' }));
  await assertFails(setDoc(profile(attacker, 'attacker'), {
    nome: 'Atacante', role: 'vendedor', organizationId: 'victim-org'
  }));
  await assertFails(setDoc(profile(attacker, 'attacker'), {
    nome: 'Atacante', role: 'vendedor', isAdmin: true
  }));
  await assertSucceeds(updateDoc(profile(seller, 'seller-a'), { nome: 'Nome atualizado' }));
  await assertFails(updateDoc(profile(seller, 'seller-a'), { role: 'admin' }));
  await assertFails(updateDoc(profile(seller, 'seller-a'), { organizationId: 'victim-org' }));
  await assertFails(updateDoc(profile(seller, 'seller-a'), { role: 'vendedor', organizationId: 'victim-org' }));
  console.log('PASS: autoadministração e alteração própria de papel/organização negadas');

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(profile(db, 'seller-b'), {
      nome: 'Outro vendedor', email: 'other@example.test', role: 'vendedor', organizationId: 'org-a'
    });
    await setDoc(profile(db, 'admin-a'), {
      nome: 'Admin', email: 'admin@example.test', role: 'admin', organizationId: 'org-a'
    });
    await setDoc(profile(db, 'manager-a'), {
      nome: 'Gerente', email: 'manager@example.test', role: 'gerente', organizationId: 'org-shared'
    });
    await setDoc(profile(db, 'supervisor-a'), {
      nome: 'Supervisor', email: 'supervisor@example.test', role: 'supervisor', organizationId: 'org-shared'
    });
    for (const name of ['clients', 'leads', 'tarefas']) {
      await setDoc(doc(db, name, `${name}-seller-a`), { userId: 'seller-a', organizationId: 'org-shared' });
      await setDoc(doc(db, name, `${name}-seller-b`), { userId: 'seller-b', organizationId: 'org-shared' });
      await setDoc(doc(db, name, `${name}-manager-a`), { userId: 'manager-a', organizationId: 'org-shared' });
      await setDoc(doc(db, name, `${name}-supervisor-a`), { userId: 'supervisor-a', organizationId: 'org-shared' });
    }
  });

  await assertFails(getDoc(profile(seller, 'seller-b')));
  await assertFails(updateDoc(profile(seller, 'seller-b'), { role: 'admin' }));
  console.log('PASS: vendedor não lê nem altera perfil de outro usuário');

  for (const name of ['clients', 'leads', 'tarefas']) {
    for (const [scopedUser, scopedUid] of [[manager, 'manager-a'], [supervisor, 'supervisor-a']]) {
      await assertFails(getDoc(doc(scopedUser, name, `${name}-seller-a`)));
      await assertSucceeds(getDoc(doc(scopedUser, name, `${name}-${scopedUid}`)));
      await assertFails(getDocs(collection(scopedUser, name)));
      await assertSucceeds(getDocs(query(collection(scopedUser, name), where('userId', '==', scopedUid))));
    }
    await assertSucceeds(getDocs(collection(admin, name)));
  }
  await assertSucceeds(getDoc(doc(admin, 'clients', 'clients-seller-a')));
  console.log('PASS: gerente e supervisor limitados ao UID; admin mantém leitura global');

  await assertSucceeds(updateDoc(profile(admin, 'seller-b'), { role: 'gerente' }));
  await assertSucceeds(updateDoc(profile(admin, 'seller-b'), { organizationId: 'org-b' }));
  await assertFails(updateDoc(profile(admin, 'seller-b'), { role: 'root' }));
  await assertFails(updateDoc(profile(admin, 'admin-a'), { role: 'vendedor' }));
  await assertFails(updateDoc(profile(admin, 'admin-a'), { organizationId: 'org-b' }));
  console.log('PASS: admin pode atribuir papel permitido a outra conta, mas não alterar o próprio');

  await assertSucceeds(getDoc(profile(admin, 'seller-b')));
  await assertFails(getDoc(profile(seller, 'admin-a')));
  await assertFails(setDoc(doc(seller, 'colecao_nova/doc-1'), { userId: 'seller-a' }));
  await assertSucceeds(setDoc(doc(seller, 'csv_mappings/map-1'), { userId: 'seller-a', nome: 'CSV' }));
  await assertSucceeds(getDoc(doc(seller, 'csv_mappings/map-1')));

  const audit = doc(seller, 'audit_events/audit-1');
  await assertSucceeds(setDoc(audit, {
    userId: 'seller-a', userEmail: 'seller@example.test', acao: 'TEST',
    detalhes: { recordId: 'test' }, timestamp: '2026-01-01', userAgent: 'test'
  }));
  await assertFails(getDoc(doc(manager, 'audit_events/audit-1')));
  await assertSucceeds(getDoc(doc(admin, 'audit_events/audit-1')));
  await assertFails(updateDoc(doc(admin, 'audit_events/audit-1'), { acao: 'ALTERADO' }));
  await assertFails(deleteDoc(doc(admin, 'audit_events/audit-1')));

  const notification = doc(seller, 'notificacoes/notif-1');
  await assertSucceeds(setDoc(notification, { userId: 'seller-a', mensagem: 'Privada' }));
  await assertFails(getDoc(doc(manager, 'notificacoes/notif-1')));
  await assertSucceeds(getDoc(doc(admin, 'notificacoes/notif-1')));

  const job = doc(seller, 'import_jobs/job-1');
  await assertSucceeds(setDoc(job, {
    organization_id: 'seller-a', user_id: 'seller-a', original_filename: 'leads.csv',
    file_hash: 'abc', total_rows: 1, valid_rows: 1, invalid_rows: 0,
    created_count: 0, updated_count: 0, skipped_count: 0, failed_count: 0,
    status: 'IMPORTING', started_at: '2026-01-01', completed_at: null,
    error_summary: '', origin: 'csv', base_legal: false,
    base_legal_declarada_em: '2026-01-01'
  }));
  await assertSucceeds(updateDoc(job, {
    status: 'COMPLETED', created_count: 1, updated_count: 0,
    skipped_count: 0, failed_count: 0, completed_at: '2026-01-01', error_summary: ''
  }));
  await assertFails(updateDoc(job, { user_id: 'seller-b' }));
  await assertFails(updateDoc(job, { original_filename: 'substituido.csv' }));
  await assertFails(getDoc(doc(manager, 'import_jobs/job-1')));
  await assertSucceeds(getDoc(doc(admin, 'import_jobs/job-1')));
  await assertFails(updateDoc(doc(admin, 'import_jobs/job-1'), { status: 'COMPLETED' }));
  console.log('PASS: perfis, CSV mappings, auditoria e importações restritos; coleções novas negadas');
} finally {
  await env.cleanup();
}
