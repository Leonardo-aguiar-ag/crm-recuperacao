import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const projectId = 'demo-crm-security';
const firestoreRules = await readFile(resolve(root, 'firebase/firestore.rules'), 'utf8');
const storageRules = await readFile(resolve(root, 'firebase/storage.rules'), 'utf8');
const env = await initializeTestEnvironment({
  projectId,
  firestore: { rules: firestoreRules },
  storage: { rules: storageRules },
});

try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/seller-a'), { role: 'vendedor' });
    await setDoc(doc(db, 'usuarios/seller-b'), { role: 'vendedor' });
    await setDoc(doc(db, 'usuarios/manager-a'), { role: 'gerente' });
    await setDoc(doc(db, 'usuarios/supervisor-a'), { role: 'supervisor' });
    await setDoc(doc(db, 'usuarios/admin-a'), { role: 'admin' });
    await setDoc(doc(db, 'clients/client-a'), { userId: 'seller-a', organizationId: 'org-shared' });
    await setDoc(doc(db, 'clients/client-b'), {
      userId: 'seller-b', vendedorId: 'manager-a', organizationId: 'org-shared'
    });
    await setDoc(doc(db, 'clients/client-legacy'), { organizationId: 'seller-a' });
    const payload = new TextEncoder().encode('private test file');
    for (const path of [
      'clientes/client-a/anexos/a.txt',
      'clientes/client-b/anexos/b.txt',
      'clientes/client-legacy/anexos/legacy.txt',
      'backups/seller-a/backup.json',
      'backups/seller-b/backup.json'
    ]) {
      await uploadBytes(ref(ctx.storage(), path), payload, { contentType: 'text/plain' });
    }
  });

  const seller = env.authenticatedContext('seller-a').storage();
  const manager = env.authenticatedContext('manager-a').storage();
  const supervisor = env.authenticatedContext('supervisor-a').storage();
  const admin = env.authenticatedContext('admin-a').storage();
  await assertSucceeds(getBytes(ref(seller, 'clientes/client-a/anexos/a.txt')));
  await assertSucceeds(getBytes(ref(seller, 'clientes/client-legacy/anexos/legacy.txt')));
  await assertFails(getBytes(ref(seller, 'clientes/client-b/anexos/b.txt')));

  await assertFails(getBytes(ref(manager, 'clientes/client-b/anexos/b.txt')));
  await assertFails(getBytes(ref(supervisor, 'clientes/client-b/anexos/b.txt')));
  await assertFails(uploadBytes(
    ref(manager, 'clientes/client-b/anexos/manager-upload.txt'),
    new TextEncoder().encode('no'),
    { contentType: 'text/plain' },
  ));
  await assertFails(getBytes(ref(manager, 'backups/seller-b/backup.json')));
  await assertFails(getBytes(ref(supervisor, 'backups/seller-b/backup.json')));
  await assertFails(uploadBytes(
    ref(manager, 'backups/seller-b/manager.json'),
    new TextEncoder().encode('{}'),
    { contentType: 'application/json' },
  ));
  console.log('PASS: vendedor, gerente e supervisor não acessam anexos/backups de outra conta');

  await assertSucceeds(getBytes(ref(admin, 'clientes/client-b/anexos/b.txt')));
  await assertSucceeds(getBytes(ref(admin, 'backups/seller-b/backup.json')));
  console.log('PASS: admin mantém acesso administrativo a anexos e backups');
} finally {
  await env.cleanup();
}
